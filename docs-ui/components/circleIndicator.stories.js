import React from 'react';

import CircleIndicator from 'app/components/circleIndicator';

export default {
  title: 'DataVisualization/CircleIndicator',
  component: CircleIndicator,
  args: {
    size: 14,
    enabled: false,
  },
};

export const Default = ({size, enabled}) => {
  return (
    <React.Fragment>
      <CircleIndicator style={{marginRight: 12}} size={size} enabled={enabled} />

      <CircleIndicator style={{marginRight: 12}} size={size} enabled={!enabled} />

      <CircleIndicator size={size} enabled={enabled} color="purple300" />
    </React.Fragment>
  );
};

Default.storyName = 'CircleIndicator';
