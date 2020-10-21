import { withInfo } from '@storybook/addon-info';

import ContextData from 'app/components/contextData';

export default {
  title: 'UI/ContextData',
};

export const Strings = withInfo('Default')(() => (
  <ContextData data="https://example.org/foo/bar/" />
));

Strings.story = {
  name: 'strings',
};
