import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Highlight from 'app/components/highlight';

export default {
  title: 'Utility/Highlight',
};

export const HighlightASubstring = withInfo(
  'Highlights a string within another string'
)(() => <Highlight text="ILL">billy@sentry.io</Highlight>);

HighlightASubstring.story = {
  name: 'Highlight a substring',
};
