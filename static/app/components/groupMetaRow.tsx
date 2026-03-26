import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ExternalLink, Link} from '@sentry/scraps/link';

import {
  getAutofixRunExists,
  isIssueQuickFixable,
} from 'sentry/components/events/autofix/utils';
import {EventAnnotation} from 'sentry/components/events/eventAnnotation';
import {ShortId} from 'sentry/components/group/inboxBadges/shortId';
import {TimesTag} from 'sentry/components/group/inboxBadges/timesTag';
import {UnhandledTag} from 'sentry/components/group/inboxBadges/unhandledTag';
import {IssueReplayCount} from 'sentry/components/group/issueReplayCount';
import {IssueSeerBadge} from 'sentry/components/group/issueSeerBadge';
import {IssueSuperGroup} from 'sentry/components/group/issueSuperGroup';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {IconChat} from 'sentry/icons';
import {tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getTitle} from 'sentry/utils/events';
import {useReplayCountForIssues} from 'sentry/utils/replayCount/useReplayCountForIssues';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import {useSuperGroupForIssues} from 'sentry/utils/supergroup/useSuperGroupForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

type Props = {
  data: Group;
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

export function GroupMetaRow({data, showAssignee, showLifetime = true}: Props) {
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
  } = data;
  const organization = useOrganization();
  const location = useLocation();

  const issuesPath = `/organizations/${organization.slug}/issues/`;
  const {getReplayCountForIssue} = useReplayCountForIssues();
  const {getSuperGroupForIssue} = useSuperGroupForIssues();

  const showReplayCount =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, project) &&
    data.issueCategory &&
    !!getReplayCountForIssue(data.id, data.issueCategory);

  const supergroup = organization.features.includes('top-issues-ui')
    ? getSuperGroupForIssue(data.id)
    : undefined;

  const autofixRunExists = getAutofixRunExists(data);
  const seerFixable = isIssueQuickFixable(data);
  const showSeer =
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures &&
    (autofixRunExists || seerFixable);

  const {subtitle} = getTitle(data);

  const items = [
    shortId ? (
      <ShortId
        shortId={shortId}
        avatar={
          project && <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
        }
      />
    ) : null,
    isUnhandled ? <UnhandledTag /> : null,
    showLifetime ? (
      <Lifetime firstSeen={firstSeen} lastSeen={lastSeen} lifetime={lifetime} />
    ) : null,
    subtitle ? <Location>{subtitle}</Location> : null,
    numComments > 0 ? (
      <CommentsLink
        to={{
          pathname: `${issuesPath}${id}/activity/`,
          // Filter activity to only show comments
          query: {filter: 'comments'},
        }}
      >
        <IconChat
          size="xs"
          variant={subscriptionDetails?.reason === 'mentioned' ? 'success' : undefined}
        />
        <span>{numComments}</span>
      </CommentsLink>
    ) : null,
    showReplayCount ? <IssueReplayCount group={data} /> : null,
    supergroup ? <IssueSuperGroup supergroup={supergroup} /> : null,
    showSeer ? <IssueSeerBadge group={data} key="issue-seer-badge" /> : null,
    logger ? (
      <LoggerAnnotation>
        <Link
          to={{
            pathname: issuesPath,
            query: {
              ...extractSelectionParameters(location.query),
              query: `logger:${logger}`,
            },
          }}
        >
          {logger}
        </Link>
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
    <GroupExtra>
      {items.map((item, i) => {
        if (!item) {
          return null;
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

const GroupExtra = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${p => p.theme.space.sm};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
  line-height: 1.2;
  min-height: ${p => p.theme.space.xl};

  & > a {
    color: ${p => p.theme.tokens.content.secondary};
    position: relative;
  }

  & > a:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    line-height: 1;
  }
`;

const Separator = styled('div')`
  height: 10px;
  width: 1px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background-color: ${p => p.theme.tokens.border.secondary};
  border-radius: 1px;
`;

const ShadowlessProjectBadge = styled(ProjectBadge)`
  * > img {
    box-shadow: none;
  }
`;

const CommentsLink = styled(Link)`
  display: inline-grid;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.tokens.content.primary};
  position: relative;
`;

const AnnotationNoMargin = styled(EventAnnotation)`
  margin-left: 0;
  padding-left: 0;
  border-left: none;
  position: relative;

  & > a:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;

const LoggerAnnotation = styled(AnnotationNoMargin)`
  color: ${p => p.theme.tokens.content.primary};
  position: relative;
  min-width: 10px;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Location = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  min-width: 10px;
  line-height: 1.1;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
// trivial change for CI testing
