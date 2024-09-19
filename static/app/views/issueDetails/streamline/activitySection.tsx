import {Fragment} from 'react';
import styled from '@emotion/styled';

import Timeline from 'sentry/components/timeline';
import TimeSince from 'sentry/components/timeSince';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {GroupActivityTypeIconMapping} from 'sentry/views/issueDetails/streamline/groupActivityIcons';
import getGroupActivityItem from 'sentry/views/issueDetails/streamline/groupActivityItem';

function StreamlinedActivitySection({group}: {group: Group}) {
  const organization = useOrganization();

  return (
    <Fragment>
      <Timeline.Container>
        {group.activity.map(item => {
          const authorName = item.user ? item.user.name : 'Sentry';
          const {title, message} = getGroupActivityItem(
            item,
            organization,
            group.project.id,
            <Author>{authorName}</Author>
          );
          return (
            <Timeline.Item
              title={title}
              timestamp={<TimeSince date={item.dateCreated} />}
              icon={GroupActivityTypeIconMapping[item.type]}
              key={item.id}
            >
              {message}
            </Timeline.Item>
          );
        })}
      </Timeline.Container>
    </Fragment>
  );
}

const Author = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

export default StreamlinedActivitySection;
