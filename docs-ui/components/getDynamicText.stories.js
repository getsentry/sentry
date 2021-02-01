import React from 'react';

import getDynamicText from 'app/utils/getDynamicText';

export default {
  title: 'Utilities/GetDynamicText',
  component: getDynamicText,
};

export const Default = () => {
  return (
    <React.Fragment>
      {getDynamicText({
        fixed: 'Fixed Content',
        value: 'Pretend this is a dynamic value',
      })}
    </React.Fragment>
  );
};

Default.storyName = 'GetDynamicText';
