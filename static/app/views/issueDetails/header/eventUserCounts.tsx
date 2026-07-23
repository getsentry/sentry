import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {IconStack, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {Divider} from 'sentry/views/issueDetails/divider';

interface EventUserCountsProps {
  group: Group;
  project: Project;
}

/**
 * Compact event + affected-user counts for the issue preview status line, e.g.
 * a stack icon with "2.6k" events and a user icon with "11" users.
 */
export function EventUserCounts({group, project}: EventUserCountsProps) {
  if (!getConfigForIssueType(group, project).eventAndUserCounts.enabled) {
    return null;
  }

  const {count: eventCount, userCount} = group;

  return (
    <Fragment>
      <Divider />
      <Flex align="center" gap="md">
        <Tooltip title={t('Events')} skipWrapper>
          <Flex align="center" gap="xs">
            <IconStack size="xs" />
            <Text size="sm" variant="muted" aria-label={t('Event count')}>
              <Count value={eventCount} />
            </Text>
          </Flex>
        </Tooltip>
        <Tooltip title={t('Affected users')} skipWrapper>
          <Flex align="center" gap="xs">
            <IconUser size="xs" />
            <Text size="sm" variant="muted" aria-label={t('User count')}>
              <Count value={userCount} />
            </Text>
          </Flex>
        </Tooltip>
      </Flex>
    </Fragment>
  );
}
