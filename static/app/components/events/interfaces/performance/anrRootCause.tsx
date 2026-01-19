import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {analyzeFramesForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import {StackTraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace';
import NoStackTraceMessage from 'sentry/components/events/interfaces/noStackTraceMessage';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {
  getEventTimestampInSeconds,
  getThreadById,
  inferPlatform,
} from 'sentry/components/events/interfaces/utils';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ShortId from 'sentry/components/group/inboxBadges/shortId';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {StackView} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import useProjects from 'sentry/utils/useProjects';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useIssuesTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useIssuesTraceTree';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import useTraceStateAnalytics from 'sentry/views/performance/newTraceDetails/useTraceStateAnalytics';

enum AnrRootCauseAllowlist {
  PERFORMANCE_FILE_IO_MAIN_THREAD_GROUP_TYPE = 1008,
  PERFORMANCE_DB_MAIN_THREAD_GROUP_TYPE = 1013,
}

interface Props {
  event: Event;
  organization: Organization;
}

export function AnrRootCause({event, organization}: Props) {
  const traceSlug = event.contexts.trace?.trace_id ?? '';

  const trace = useTrace({
    timestamp: getEventTimestampInSeconds(event),
    traceSlug,
    limit: 10000,
  });
  const tree = useIssuesTraceTree({trace, replay: null});
  useTraceStateAnalytics({
    trace,
    organization,
    traceTreeSource: 'issue_details_anr_root_cause',
    tree,
  });

  const traceNode = tree.root.children[0];

  const {projects} = useProjects();

  const anrCulprit = analyzeFramesForRootCause(event);

  useEffect(() => {
    if (!anrCulprit?.culprit) {
      return;
    }

    trackAnalytics('issue_group_details.anr_root_cause_detected', {
      organization,
      group: event?.groupID,
      culprit: typeof anrCulprit?.culprit === 'string' ? anrCulprit?.culprit : 'lock',
    });
  }, [anrCulprit, organization, event?.groupID]);

  if (tree.type === 'loading' || tree.type === 'error') {
    return null;
  }

  const occurrences = Array.from(traceNode?.occurrences ?? []);
  const noPerfIssueOnTrace = occurrences.length === 0;

  if (noPerfIssueOnTrace && !anrCulprit) {
    return null;
  }

  const potentialAnrRootCause = occurrences.filter(issue =>
    Object.values(AnrRootCauseAllowlist).includes(issue.type as AnrRootCauseAllowlist)
  );

  const helpText =
    !potentialAnrRootCause || potentialAnrRootCause.length === 0
      ? t(
          'Suspect Root Cause identifies common patterns that may be contributing to this ANR'
        )
      : t(
          'Suspect Root Cause identifies potential Performance Issues that may be contributing to this ANR.'
        );

  function renderAnrCulprit() {
    if (!defined(anrCulprit)) {
      return undefined;
    }

    if (typeof anrCulprit.culprit === 'string') {
      return <Fragment>{anrCulprit.resources}</Fragment>;
    }

    const {address, thread_id} = anrCulprit.culprit;
    if (!defined(thread_id)) {
      return <Fragment>{anrCulprit.resources}</Fragment>;
    }

    const culpritThread = getThreadById(event, thread_id);
    const stackTrace = getThreadStacktrace(false, culpritThread);
    const platform = inferPlatform(event, culpritThread);

    return (
      <Fragment>
        {anrCulprit?.resources}
        <StackTraceWrapper>
          {defined(stackTrace) ? (
            <StackTraceContent
              stacktrace={stackTrace}
              stackView={StackView.FULL}
              newestFirst
              event={event}
              platform={platform}
              lockAddress={address ?? undefined}
            />
          ) : (
            <NoStackTraceMessage />
          )}
        </StackTraceWrapper>
      </Fragment>
    );
  }

  return (
    <InterimSection
      title={t('Suspect Root Cause')}
      type={SectionKey.SUSPECT_ROOT_CAUSE}
      help={helpText}
    >
      {potentialAnrRootCause?.map(occurence => {
        const project = projects.find(p => p.id === occurence.project_id.toString());
        const isEAPOccurence = 'description' in occurence;
        const title = isEAPOccurence ? occurence.description : occurence.title;
        const shortId = isEAPOccurence ? occurence.short_id : occurence.issue_short_id;
        return (
          <IssueSummary key={occurence.issue_id}>
            <Title>
              <TitleWithLink
                to={{
                  pathname: `/organizations/${organization.id}/issues/${occurence.issue_id}/${
                    occurence.event_id ? `events/${occurence.event_id}/` : ''
                  }`,
                }}
              >
                {title}
                <Fragment>
                  <Spacer />
                  <Subtitle title={occurence.culprit}>{occurence.culprit}</Subtitle>
                </Fragment>
              </TitleWithLink>
            </Title>
            {shortId && (
              <ShortId
                shortId={shortId}
                avatar={
                  project && <ProjectBadge project={project} hideName avatarSize={12} />
                }
              />
            )}
          </IssueSummary>
        );
      })}
      {organization.features.includes('anr-analyze-frames') && renderAnrCulprit()}
    </InterimSection>
  );
}

const IssueSummary = styled('div')`
  padding-bottom: ${space(2)};
`;

/**
 * &nbsp; is used instead of margin/padding to split title and subtitle
 * into 2 separate text nodes on the HTML AST. This allows the
 * title to be highlighted without spilling over to the subtitle.
 */
function Spacer() {
  return <span style={{display: 'inline-block', width: 10}}>&nbsp;</span>;
}

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
`;

const TitleWithLink = styled(GlobalSelectionLink)`
  display: flex;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Title = styled('div')`
  line-height: 1;
  margin-bottom: ${space(0.5)};
`;

const StackTraceWrapper = styled('div')`
  margin-top: ${space(2)};
`;
