import { build, context } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');

async function runBuild() {
  console.log('🚀 Building oda...');

  // Nettoyage du dossier dist
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  const buildOptions = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: !isWatch,
    sourcemap: true,
    format: 'esm',
    outfile: 'dist/index.mjs',
    platform: 'browser',
    target: ['es2020'],
  };

  if (isWatch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } else {
    await build(buildOptions);
    
    // Génération des types TypeScript uniquement en mode build
    console.log('📝 Generating types...');
    try {
      execSync('pnpm tsc', { stdio: 'inherit' });
    } catch (e) {
      console.error('❌ Type generation failed');
    }
    
    console.log('✅ Build complete!');
  }
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
