const COLLECTION_ID = '30th-celebration';
class CollectionStore {
  constructor(pool, loginId) {this.pool = pool; this.collectionId = loginId ? COLLECTION_ID + ':' + loginId : COLLECTION_ID}
  async register() {
    const result = await this.pool.query('INSERT INTO pokemon_collections (collection_id, initialized) VALUES ($1, true) ON CONFLICT (collection_id) DO NOTHING RETURNING collection_id', [this.collectionId]);
    if (!result.rows.length) throw Object.assign(new Error('Login already exists'), {code:'LOGIN_EXISTS'});
    return this.read();
  }
  async read(client = this.pool) {
    const result = await client.query(`
      SELECT c.initialized, c.revision::text, c.updated_at,
             COALESCE(jsonb_object_agg(s.card_id, s.owned) FILTER (WHERE s.card_id IS NOT NULL), '{}'::jsonb) AS owned
      FROM pokemon_collections c
      LEFT JOIN pokemon_collection_cards s ON s.collection_id = c.collection_id
      WHERE c.collection_id = $1
      GROUP BY c.collection_id`, [this.collectionId]);
    if (!result.rows.length) throw Object.assign(new Error('Login not found'),{code:'LOGIN_NOT_FOUND'});
    const row = result.rows[0];
    return {initialized:row.initialized, revision:Number(row.revision), updatedAt:new Date(row.updated_at).toISOString(), owned:row.owned};
  }
  async update(changes, initialize = false) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT initialized, revision::text FROM pokemon_collections WHERE collection_id=$1 FOR UPDATE',[this.collectionId]);
      if (!current.rows.length) throw Object.assign(new Error('Run the database migration.'),{code:'SCHEMA_NOT_READY'});
      if (!initialize || !current.rows[0].initialized) {
        const revision = Number(current.rows[0].revision) + 1;
        if (changes.length) {
          await client.query(`
            INSERT INTO pokemon_collection_cards (collection_id,card_id,owned,updated_revision)
            SELECT $1, incoming.card_id, incoming.owned, $4
            FROM unnest($2::text[], $3::boolean[]) AS incoming(card_id,owned)
            ON CONFLICT (collection_id,card_id) DO UPDATE
            SET owned=excluded.owned, updated_revision=excluded.updated_revision`,
          [this.collectionId,changes.map(c=>c.id),changes.map(c=>c.owned),revision]);
        }
        await client.query('UPDATE pokemon_collections SET initialized=true, revision=$2, updated_at=now() WHERE collection_id=$1',[this.collectionId,revision]);
      }
      const snapshot = await this.read(client);
      await client.query('COMMIT');
      return snapshot;
    } catch (error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally {client.release()}
  }
}
module.exports = {CollectionStore};
