import styled from '@emotion/styled';

import {ExternalLink, Link} from '@sentry/scraps/link';

import {
  getAutofixRunExists,
  isIssueQuickFixable,
} from 'sentry/components/events/autofix/utils';
import {ShortId} from 'sentry/components/group/inboxBadges/shortId';
import {TimesTag} from 'sentry/components/group/inboxBadges/timesTag';
import {UnhandledTag} from 'sentry/components/group/inboxBadges/unhandledTag';
import {IssueReplayCount} from 'sentry/components/group/issueReplayCount';
import {IssueSeerBadge} from 'sentry/components/group/issueSeerBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {IconChat} from 'sentry/icons';
import {tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {getTitle} from 'sentry/utils/events';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
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

  const showReplayCount =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, project);

  const autofixRunExists = getAutofixRunExists(data);
  const seerFixable = isIssueQuickFixable(data);
  const showSeer =
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures &&
    (autofixRunExists || seerFixable);

  const {subtitle} = getTitle(data);

  return (
    <GroupExtra>
      {shortId ? (
        <ShortId
          shortId={shortId}
          avatar={
            project && (
              <ShadowlessProjectBadge project={project} avatarSize={12} hideName />
            )
          }
        />
      ) : null}
      {isUnhandled ? <UnhandledTag /> : null}
      {showLifetime ? (
        <Lifetime firstSeen={firstSeen} lastSeen={lastSeen} lifetime={lifetime} />
      ) : null}
      {subtitle ? <Location>{subtitle}</Location> : null}
      {numComments > 0 ? (
        <CommentsLink
          to={{
            pathname: `${issuesPath}${id}/activity/`,
            query: {filter: 'comments'},
          }}
        >
          <IconChat
            size="xs"
            variant={subscriptionDetails?.reason === 'mentioned' ? 'success' : undefined}
          />
          <span>{numComments}</span>
        </CommentsLink>
      ) : null}
      {showReplayCount ? <IssueReplayCount group={data} /> : null}
      {showSeer ? <IssueSeerBadge group={data} /> : null}
      {logger ? (
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
      ) : null}
      {annotations?.map((annotation, key) => (
        <Annotation key={key}>
          <ExternalLink href={annotation.url}>{annotation.displayName}</ExternalLink>
        </Annotation>
      ))}
      {showAssignee && assignedTo ? (
        <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
      ) : null}
    </GroupExtra>
  );
}

const GroupExtra = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
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

  /* Adds a 1px vertical separator between visible siblings, automatically
     skipping children that render null */
  & > * + * {
    margin-left: ${p => p.theme.space.sm};
    padding-left: ${p => p.theme.space.sm};
    /* eslint-disable @sentry/scraps/use-semantic-token */
    background-image: linear-gradient(
      ${p => p.theme.tokens.border.secondary},
      ${p => p.theme.tokens.border.secondary}
    );
    /* eslint-enable @sentry/scraps/use-semantic-token */
    background-position: left center;
    background-size: 1px 10px;
    background-repeat: no-repeat;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    line-height: 1;
  }
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

const Annotation = styled('span')`
  a {
    color: ${p => p.theme.tokens.content.secondary};
  }

  a:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;

const LoggerAnnotation = styled(Annotation)`
  color: ${p => p.theme.tokens.content.primary};
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
