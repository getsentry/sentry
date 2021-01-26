import React from 'react';

import ScoreBar from 'app/components/scoreBar';

export default {
  title: 'DataVisualization/ScoreBar',
  args: {
    vertical: false,
    size: 40,
    thickness: 4,
    score: 3,
  },
};

const Template = ({...args}) => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ScoreBar {...args} />
  </div>
);

export const Horizontal = Template.bind({});
Horizontal.storyName = 'horizontal';

export const Vertical = Template.bind({});
Vertical.args = {vertical: true};
Vertical.storyName = 'vertical';

export const CustomPalette = Template.bind({});
CustomPalette.storyName = 'custom palette';
CustomPalette.args = {
  palette: ['pink', 'yellow', 'lime', 'blue', 'purple'],
};
