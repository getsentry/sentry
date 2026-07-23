import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {IconStack, IconUser} from 'sentry/icons';
import {tn} from 'sentry/locale';
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

  const eventCount = Number(group.count);
  const {userCount} = group;

  // Use the full numbers in the tooltip/accessible label so the exact counts
  // are available even though the visible value is abbreviated (e.g. "2.6K").
  const eventLabel = tn('%s event', '%s events', eventCount);
  const userLabel = tn('%s affected user', '%s affected users', userCount);

  return (
    <Fragment>
      <Divider />
      <Flex align="center" gap="md">
        <Tooltip title={eventLabel} skipWrapper>
          <Flex align="center" gap="xs" aria-label={eventLabel}>
            <IconStack size="xs" />
            <Text size="sm" variant="muted" aria-hidden>
              <Count value={eventCount} />
            </Text>
          </Flex>
        </Tooltip>
        <Tooltip title={userLabel} skipWrapper>
          <Flex align="center" gap="xs" aria-label={userLabel}>
            <IconUser size="xs" />
            <Text size="sm" variant="muted" aria-hidden>
              <Count value={userCount} />
            </Text>
          </Flex>
        </Tooltip>
      </Flex>
    </Fragment>
  );
}
