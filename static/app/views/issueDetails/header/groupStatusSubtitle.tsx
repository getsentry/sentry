import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import {UnhandledTag} from 'sentry/components/group/inboxBadges/unhandledTag';
import {tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getTitle} from 'sentry/utils/events';
import {Divider} from 'sentry/views/issueDetails/divider';
import {AttachmentsBadge} from 'sentry/views/issueDetails/header/attachmentsBadge';
import {ReplayBadge} from 'sentry/views/issueDetails/header/replayBadge';
import {SeerBadge} from 'sentry/views/issueDetails/header/seerBadge';
import {UserFeedbackBadge} from 'sentry/views/issueDetails/header/userFeedbackBadge';

interface GroupStatusSubtitleProps {
  group: Group;
  project: Project;
}

export function GroupStatusSubtitle({group, project}: GroupStatusSubtitleProps) {
  const {subtitle} = getTitle(group);
  const statusProps = getBadgeProperties(group.status, group.substatus);

  return (
    <Flex gap="md" align="center" minWidth={0}>
      {group.isUnhandled && (
        <Fragment>
          <UnhandledTag />
          <Divider />
        </Fragment>
      )}
      {statusProps?.status && (
        <Tooltip
          isHoverable
          title={tct('[tooltip] [link:Learn more]', {
            tooltip: statusProps.tooltip,
            link: (
              <ExternalLink href="https://docs.sentry.io/product/issues/states-triage/" />
            ),
          })}
        >
          <Subtext>{statusProps.status}</Subtext>
        </Tooltip>
      )}
      {subtitle && (
        <Fragment>
          <Divider />
          <Tooltip
            title={subtitle}
            skipWrapper
            isHoverable
            showOnlyOnOverflow
            delay={1000}
          >
            <Subtext>{subtitle}</Subtext>
          </Tooltip>
        </Fragment>
      )}
      <ErrorBoundary customComponent={null}>
        <AttachmentsBadge group={group} />
        <UserFeedbackBadge group={group} project={project} />
        <ReplayBadge group={group} project={project} />
        <SeerBadge group={group} />
      </ErrorBoundary>
    </Flex>
  );
}

const Subtext = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
