import Well from 'sentry/components/well';

export default {
  title: 'Components/Well',
  component: Well,
};

const Template = ({...args}) => (
  <Well {...args}>
    <p>Some content in the well</p>
  </Well>
);

export const _Well = Template.bind({});
_Well.args = {
  hasImage: false,
  centered: false,
};
_Well.parameters = {
  docs: {
    description: {
      story: 'Well is a container that adds background and padding',
    },
  },
};
