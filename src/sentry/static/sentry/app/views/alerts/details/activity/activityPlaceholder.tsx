import {withTheme} from 'emotion-theming';
import React from 'react';
import styled from '@emotion/styled';

import ActivityItem from 'app/components/activity/item';
import space from 'app/styles/space';

export default withTheme(function ActivityPlaceholder(props) {
  return (
    <ActivityItem
      bubbleProps={{
        backgroundColor: props.theme.backgroundAccent,
        borderColor: props.theme.backgroundAccent,
      }}
    >
      {() => <Placeholder />}
    </ActivityItem>
  );
});

const Placeholder = styled('div')`
  padding: ${space(4)};
`;
