import LoadingIndicator from 'sentry/components/loadingIndicator';
import LoadingTriangle from 'sentry/components/loadingTriangle';

export default {
  title: 'Components/Loading Indicators',
  component: LoadingIndicator,
};

export const All = () => (
  <div>
    <div>
      Default
      <LoadingIndicator />
    </div>
    <div style={{marginBottom: 240}}>
      Mini
      <LoadingIndicator mini />
    </div>
    <div>
      Triangle
      <div style={{position: 'relative'}}>
        <LoadingTriangle />
      </div>
    </div>
  </div>
);

All.storyName = 'Overview';
All.parameters = {
  docs: {
    description: {
      story: 'Loading indicators. Triangle has negative margins.',
    },
  },
};

export const Default = () => <LoadingIndicator>Loading message</LoadingIndicator>;

Default.storyName = 'Default';

export const Mini = () => <LoadingIndicator mini>Loading message</LoadingIndicator>;

Mini.storyName = 'Mini';
Mini.parameters = {
  docs: {
    description: {
      story: 'Small loading indicator',
    },
  },
};

export const Triangle = () => (
  <div style={{paddingBottom: 300}}>
    <LoadingTriangle>Loading message</LoadingTriangle>
  </div>
);

Triangle.storyName = 'Triangle';
Triangle.parameters = {
  docs: {
    description: {
      story: 'Triangle loading indicator. Be aware it has negative margins.',
    },
  },
};
