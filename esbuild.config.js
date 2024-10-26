require('esbuild').build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/bundle.js',
  bundle: true,
  minify: false,
  platform: 'node',
  loader: {
    '.ts': 'ts',
  },
  // ... other options ...
}).catch(console.error);

