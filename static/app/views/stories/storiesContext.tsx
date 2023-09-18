export default function storiesContext() {
  const context = require.context('../..', true, /\.stories.tsx$/, 'lazy');
  return {
    files: context.keys,
    importStory: context,
  };
}
