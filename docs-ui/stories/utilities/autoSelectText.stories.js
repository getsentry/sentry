import AutoSelectText from 'sentry/components/autoSelectText';

export default story = {
  title: 'Utilities/Text/Auto Select',
  component: AutoSelectText,
};

export const Default = () => <AutoSelectText>Click to highlight text</AutoSelectText>;
Default.storyName = 'Auto Select';
Default.parameters = {
  docs: {
    description: {
      story: 'Select text on click',
    },
  },
};
