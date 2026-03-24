import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Text} from '@sentry/scraps/text';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {LoadingStreamGroup, StreamGroup} from 'sentry/components/stream/group';
import {IconChevron, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

const EXPANDED_COLUMNS: GroupListColumn[] = ['event', 'users', 'priority', 'assignee'];

interface Props {
  currentGroupId: string;
  otherCount: number;
  supergroup: SupergroupDetail;
}

export function StackIndicatorBar({supergroup, otherCount, currentGroupId}: Props) {
  const [expanded, setExpanded] = useState(false);
  const organization = useOrganization();

  const otherIds = supergroup.group_ids.map(String).filter(id => id !== currentGroupId);

  const issueIdQuery =
    otherIds.length === 1
      ? `issue.id:${otherIds[0]}`
      : `issue.id:[${otherIds.join(',')}]`;

  const {data: groups, isPending} = useApiQuery<Group[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {query: issueIdQuery, limit: 25, project: ALL_ACCESS_PROJECTS}},
    ],
    {staleTime: 30_000, enabled: expanded && otherIds.length > 0}
  );

  return (
    <Fragment>
      <Bar onClick={() => setExpanded(prev => !prev)}>
        <InteractionStateLayer />
        <CurvedArrow aria-hidden>&#8627;</CurvedArrow>
        <StyledIconStack size="xs" />
        <Text size="xs" bold>
          {t('%s related issues', otherCount)}
        </Text>
        <Dot />
        <Title size="xs" variant="muted">
          {supergroup.title}
        </Title>
        <ExpandIcon size="xs" direction={expanded ? 'up' : 'down'} />
      </Bar>

      {expanded && (
        <ExpandedContent>
          {isPending
            ? Array.from({length: Math.min(otherCount, 5)}).map((_, i) => (
                <LoadingStreamGroup
                  key={`placeholder-${i}`}
                  withChart={false}
                  withColumns={EXPANDED_COLUMNS}
                />
              ))
            : groups?.map(group => (
                <StreamGroup
                  key={group.id}
                  group={group}
                  canSelect={false}
                  withChart={false}
                  withColumns={EXPANDED_COLUMNS}
                  source="supergroup-expansion"
                />
              ))}
        </ExpandedContent>
      )}
    </Fragment>
  );
}

const Bar = styled('button')`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  width: 100%;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};
  font-family: inherit;
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  text-align: left;
`;

const CurvedArrow = styled('span')`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1;
`;

const StyledIconStack = styled(IconStack)`
  flex-shrink: 0;
`;

const Dot = styled('div')`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.border.secondary};
  flex-shrink: 0;
`;

const Title = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const ExpandIcon = styled(IconChevron)`
  flex-shrink: 0;
  margin-left: auto;
`;

const ExpandedContent = styled('div')`
  border-left: 3px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;
