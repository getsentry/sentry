import React from 'react';

import Well from 'app/components/well';

export default {
  title: 'UI/Well',
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
