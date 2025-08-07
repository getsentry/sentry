import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text/text';
import TimeSince from 'sentry/components/timeSince';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tct} from 'sentry/locale';
import type {SimpleGroup} from 'sentry/types/group';
import {getMessage, getTitle} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

type IssueCellProps = {
  group: SimpleGroup | null;
  className?: string;
};

export function IssueCell({group, className}: IssueCellProps) {
  const organization = useOrganization();

  if (!group) {
    return <EmptyCell />;
  }

  const {title} = getTitle(group);
  const message = getMessage(group);

  return (
    <IssueWrapper
      to={`/organizations/${organization.slug}/issues/${group.id}/`}
      className={className}
    >
      <Grid gap="xs" columns="auto 1fr">
        <ProjectAvatar project={group.project} />
        <Text data-group-title ellipsis>
          {title}
          {message ? `: ${message}` : ''}
        </Text>
      </Grid>
      <Text variant="muted">
        <Flex align="center" gap="xs">
          {tct('Last seen [time]', {
            time: (
              <TimeSince
                date={group.lastSeen}
                liveUpdateInterval={'second'}
                unitStyle="short"
                disabledAbsoluteTooltip
              />
            ),
          })}
        </Flex>
      </Text>
    </IssueWrapper>
  );
}

const IssueWrapper = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  flex: 1;
  color: ${p => p.theme.subText};

  ${p => css`
    &:hover [data-group-title] {
      color: ${p.theme.textColor};
      text-decoration: underline;
    }
  `}
`;
