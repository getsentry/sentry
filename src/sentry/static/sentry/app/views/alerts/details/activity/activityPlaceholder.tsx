import React from 'react';
import styled from '@emotion/styled';

import ActivityItem from 'app/components/activity/item';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const ActivityPlaceholder = () => (
  <ActivityItem
    bubbleProps={{
      backgroundColor: theme.backgroundSecondary,
      borderColor: theme.backgroundSecondary,
    }}
  >
    {() => <Placeholder />}
  </ActivityItem>
);

const Placeholder = styled('div')`
  padding: ${space(4)};
`;

export default ActivityPlaceholder;
