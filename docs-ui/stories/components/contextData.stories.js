import ContextData from 'sentry/components/contextData';

export default {
  title: 'Components/Context Data',
  component: ContextData,
};

export const Strings = () => <ContextData data="https://example.org/foo/bar/" />;

Strings.storyName = 'Context Data';
