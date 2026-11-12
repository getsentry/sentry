import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {t, tn} from 'sentry/locale';
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
    <Flex align="center" gap="sm">
      <Tooltip title={userLabel} skipWrapper>
        <Flex as="span" align="center" gap="xs" padding="sm 0" aria-label={userLabel}>
          <Text size="md" bold tabular>
            <Count value={userCount} />
          </Text>
          <Text size="sm" variant="muted">
            {t('Users')}
          </Text>
        </Flex>
      </Tooltip>
      <Container aria-hidden borderLeft="muted" height="16px" />
      <Tooltip title={eventLabel} skipWrapper>
        <Flex as="span" align="center" gap="xs" padding="sm 0" aria-label={eventLabel}>
          <Text size="md" bold tabular>
            <Count value={eventCount} />
          </Text>
          <Text size="sm" variant="muted">
            {t('Events')}
          </Text>
        </Flex>
      </Tooltip>
    </Flex>
  );
}
