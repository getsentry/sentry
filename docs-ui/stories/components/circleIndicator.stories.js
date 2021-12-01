import {Fragment} from 'react';

import CircleIndicator from 'sentry/components/circleIndicator';

export default {
  title: 'Components/Data Visualization/Misc/Circle Indicator',
  component: CircleIndicator,
  args: {
    size: 14,
    enabled: false,
  },
};

export const Default = ({size, enabled}) => {
  return (
    <Fragment>
      <CircleIndicator style={{marginRight: 12}} size={size} enabled={enabled} />

      <CircleIndicator style={{marginRight: 12}} size={size} enabled={!enabled} />

      <CircleIndicator size={size} enabled={enabled} color="purple300" />
    </Fragment>
  );
};

Default.storyName = 'Circle Indicator';
