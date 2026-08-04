import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {IconFile, IconUser} from 'sentry/icons';
import {tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

interface EventUserCountsProps {
  group: Group;
  project: Project;
}

export function EventUserCounts({group, project}: EventUserCountsProps) {
  if (!getConfigForIssueType(group, project).eventAndUserCounts.enabled) {
    return null;
  }

  const eventCount = Number(group.count);
  const {userCount} = group;

  const eventLabel = tn('%s event', '%s events', eventCount);
  const userLabel = tn('%s affected user', '%s affected users', userCount);

  return (
    <Flex align="center" gap="xs">
      <Tooltip title={userLabel} skipWrapper>
        <Tag variant="muted" icon={<IconUser />} aria-label={userLabel}>
          <Count value={userCount} />
        </Tag>
      </Tooltip>
      <Tooltip title={eventLabel} skipWrapper>
        <Tag variant="muted" icon={<IconFile />} aria-label={eventLabel}>
          <Count value={eventCount} />
        </Tag>
      </Tooltip>
    </Flex>
  );
}
