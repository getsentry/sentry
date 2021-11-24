import LazyLoad from 'sentry/components/lazyLoad';

export default {
  title: 'Utilities/Lazy Load',
  component: LazyLoad,
};

export const _LazyLoad = () => {
  const MyComponent = () => (
    <div>View that is loaded after 1000ms to simulate dynamic import</div>
  );

  const getComponent = () =>
    new Promise(resolve => setTimeout(() => resolve(MyComponent), 1000));

  return <LazyLoad component={getComponent} />;
};

_LazyLoad.storyName = 'Lazy Load';
_LazyLoad.parameters = {
  docs: {
    description: {
      story: 'Lazy loads a view/component',
    },
  },
};
