export default function storiesContext() {
  const context = require.context('sentry', true, /\.stories.tsx$/, 'lazy');
  return {
    files: context.keys,
    importStory: context,
  };
}
