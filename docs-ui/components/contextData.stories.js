import React from 'react';

import ContextData from 'app/components/contextData';

export default {
  title: 'UI/ContextData',
  component: ContextData,
};

export const Strings = () => <ContextData data="https://example.org/foo/bar/" />;

Strings.storyName = 'strings';
