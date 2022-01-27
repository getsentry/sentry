import {Fragment} from 'react';

import getDynamicText from 'sentry/utils/getDynamicText';

export default {
  title: 'Utilities/Get Dynamic Text',
  component: getDynamicText,
};

export const Default = () => {
  return (
    <Fragment>
      {getDynamicText({
        fixed: 'Fixed Content',
        value: 'Pretend this is a dynamic value',
      })}
    </Fragment>
  );
};

Default.storyName = 'Get Dynamic Text';
