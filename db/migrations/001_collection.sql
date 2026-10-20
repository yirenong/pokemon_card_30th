CREATE TABLE IF NOT EXISTS pokemon_collections (
  collection_id text PRIMARY KEY,
  initialized boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pokemon_collection_cards (
  collection_id text NOT NULL REFERENCES pokemon_collections(collection_id),
  card_id text NOT NULL CHECK (length(card_id) BETWEEN 1 AND 64),
  owned boolean NOT NULL,
  updated_revision bigint NOT NULL CHECK (updated_revision >= 0),
  PRIMARY KEY (collection_id, card_id)
);
INSERT INTO pokemon_collections (collection_id)
VALUES ('30th-celebration') ON CONFLICT (collection_id) DO NOTHING;
