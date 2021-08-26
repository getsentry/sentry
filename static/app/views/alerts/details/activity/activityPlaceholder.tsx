import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ActivityItem from 'app/components/activity/item';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

export default withTheme(function ActivityPlaceholder(props: {theme: Theme}) {
  return (
    <ActivityItem
      bubbleProps={{
        backgroundColor: props.theme.backgroundSecondary,
        borderColor: props.theme.backgroundSecondary,
      }}
    >
      {() => <Placeholder />}
    </ActivityItem>
  );
});

const Placeholder = styled('div')`
  padding: ${space(4)};
`;
