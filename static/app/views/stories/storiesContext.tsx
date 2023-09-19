export default function storiesContext() {
  const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');
  return {
    files: () => context.keys().map(file => file.replace(/^\.\//, 'app/')),
    importStory: (filename: string) => context(filename.replace(/^app\//, './')),
  };
}
