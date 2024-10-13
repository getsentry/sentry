import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ErrorLevelText} from 'sentry/components/events/errorLevelText';
import EventAnnotation from 'sentry/components/events/eventAnnotation';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import InboxShortId from 'sentry/components/group/inboxBadges/shortId';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import IssueReplayCount from 'sentry/components/group/issueReplayCount';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconChat} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getTitle} from 'sentry/utils/events';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  data: Event | Group;
  organization: Organization;
  showAssignee?: boolean;
  showLifetime?: boolean;
};

function Lifetime({
  firstSeen,
  lastSeen,
  lifetime,
}: {
  firstSeen: string;
  lastSeen: string;
  lifetime?: Group['lifetime'];
}) {
  if (!lifetime && !firstSeen && !lastSeen) {
    return <Placeholder height="12px" width="100px" />;
  }

  return (
    <TimesTag
      lastSeen={lifetime?.lastSeen || lastSeen}
      firstSeen={lifetime?.firstSeen || firstSeen}
    />
  );
}

function EventOrGroupExtraDetails({
  data,
  showAssignee,
  organization,
  showLifetime = true,
}: Props) {
  const {
    id,
    lastSeen,
    firstSeen,
    subscriptionDetails,
    numComments,
    logger,
    assignedTo,
    annotations,
    shortId,
    project,
    lifetime,
    isUnhandled,
  } = data as Group;

  const issuesPath = `/organizations/${organization.slug}/issues/`;

  const showReplayCount =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, project);

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');
  const {subtitle} = getTitle(data);

  const level = 'level' in data ? data.level : null;

  const items = [
    shortId ? (
      <InboxShortId
        shortId={shortId}
        avatar={
          project && <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
        }
      />
    ) : null,
    hasNewLayout && level ? <ErrorLevelText level={level} /> : null,
    isUnhandled ? <UnhandledTag /> : null,
    showLifetime ? (
      <Lifetime firstSeen={firstSeen} lastSeen={lastSeen} lifetime={lifetime} />
    ) : null,
    hasNewLayout && subtitle ? <Location>{subtitle}</Location> : null,
    numComments > 0 ? (
      <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
        <IconChat
          size="xs"
          color={subscriptionDetails?.reason === 'mentioned' ? 'successText' : undefined}
        />
        <span>{numComments}</span>
      </CommentsLink>
    ) : null,
    showReplayCount ? <IssueReplayCount group={data as Group} /> : null,
    logger ? (
      <LoggerAnnotation>
        <GlobalSelectionLink
          to={{
            pathname: issuesPath,
            query: {
              query: `logger:${logger}`,
            },
          }}
        >
          {logger}
        </GlobalSelectionLink>
      </LoggerAnnotation>
    ) : null,
    ...(annotations?.map((annotation, key) => (
      <AnnotationNoMargin key={key}>
        <ExternalLink href={annotation.url}>{annotation.displayName}</ExternalLink>
      </AnnotationNoMargin>
    )) ?? []),
    showAssignee && assignedTo ? (
      <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
    ) : null,
  ].filter(defined);

  return (
    <GroupExtra hasNewLayout={hasNewLayout}>
      {items.map((item, i) => {
        if (!item) {
          return null;
        }

        if (!hasNewLayout) {
          return <Fragment key={i}>{item}</Fragment>;
        }

        return (
          <Fragment key={i}>
            {item}
            {i < items.length - 1 ? <Separator /> : null}
          </Fragment>
        );
      })}
    </GroupExtra>
  );
}

const GroupExtra = styled('div')<{hasNewLayout: boolean}>`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${p => (p.hasNewLayout ? space(0.75) : space(1.5))};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: relative;
  min-width: 500px;
  white-space: nowrap;
  line-height: 1.2;

  a {
    color: inherit;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    line-height: 1;
  }
`;

const Separator = styled('div')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
  border-radius: 1px;
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: 0;
  border-left: none;
  & > a {
    color: ${p => p.theme.textColor};
  }
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.textColor};
`;

const Location = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

export default withOrganization(EventOrGroupExtraDetails);
