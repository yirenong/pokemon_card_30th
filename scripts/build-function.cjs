const esbuild = require('esbuild');
const fs = require('node:fs');
fs.mkdirSync('.neon/function',{recursive:true});
esbuild.buildSync({
  entryPoints:['functions/collection.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',
  outfile:'.neon/function/index.mjs',external:['pg-native'],
  banner:{js:"import{createRequire as ___cr}from'node:module';import{fileURLToPath as ___f}from'node:url';import{dirname as ___d}from'node:path';const require=___cr(import.meta.url);const __filename=___f(import.meta.url);const __dirname=___d(__filename);"}
});
