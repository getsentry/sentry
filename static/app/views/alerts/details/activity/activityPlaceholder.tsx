import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ActivityItem from 'app/components/activity/item';
import space from 'app/styles/space';

function ActivityPlaceholder() {
  const theme = useTheme();

  return (
    <ActivityItem
      bubbleProps={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.backgroundSecondary,
      }}
    >
      {() => <Placeholder />}
    </ActivityItem>
  );
}

export default ActivityPlaceholder;

const Placeholder = styled('div')`
  padding: ${space(4)};
`;
