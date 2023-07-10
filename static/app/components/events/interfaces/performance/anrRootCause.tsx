import {Fragment, useContext, useEffect} from 'react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {analyzeFramesForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import {StackTraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace';
import NoStackTraceMessage from 'sentry/components/events/interfaces/noStackTraceMessage';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {getThreadById, inferPlatform} from 'sentry/components/events/interfaces/utils';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ShortId from 'sentry/components/group/inboxBadges/shortId';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization, StackView} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useProjects from 'sentry/utils/useProjects';

enum AnrRootCauseAllowlist {
  PERFORMANCE_FILE_IO_MAIN_THREAD_GROUP_TYPE = 1008,
  PERFORMANCE_DB_MAIN_THREAD_GROUP_TYPE = 1013,
}

interface Props {
  event: Event;
  organization: Organization;
}

export function AnrRootCause({event, organization}: Props) {
  const quickTrace = useContext(QuickTraceContext);
  const {projects} = useProjects();

  const anrCulprit = analyzeFramesForRootCause(event);

  useEffect(() => {
    if (isNil(anrCulprit?.culprit)) {
      return;
    }

    trackAnalytics('issue_group_details.anr_root_cause_detected', {
      organization,
      group: event?.groupID,
      culprit: typeof anrCulprit?.culprit === 'string' ? anrCulprit?.culprit : 'lock',
    });
  }, [anrCulprit?.culprit, organization, event?.groupID]);

  const noPerfIssueOnTrace =
    !quickTrace ||
    quickTrace.error ||
    quickTrace.trace === null ||
    quickTrace.trace.length === 0 ||
    quickTrace.trace[0]?.performance_issues?.length === 0;

  if (noPerfIssueOnTrace && !anrCulprit) {
    return null;
  }

  const potentialAnrRootCause = quickTrace?.trace?.[0]?.performance_issues?.filter(
    issue =>
      Object.values(AnrRootCauseAllowlist).includes(issue.type as AnrRootCauseAllowlist)
  );

  const helpText =
    isNil(potentialAnrRootCause) || potentialAnrRootCause.length === 0
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
              hasHierarchicalGrouping={false}
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
    <EventDataSection
      title={t('Suspect Root Cause')}
      type="suspect-root-cause"
      help={helpText}
    >
      {potentialAnrRootCause?.map(issue => {
        const project = projects.find(p => p.id === issue.project_id.toString());
        return (
          <IssueSummary key={issue.issue_id}>
            <Title>
              <TitleWithLink
                to={{
                  pathname: `/organizations/${organization.id}/issues/${issue.issue_id}/${
                    issue.event_id ? `events/${issue.event_id}/` : ''
                  }`,
                }}
              >
                {issue.title}
                <Fragment>
                  <Spacer />
                  <Subtitle title={issue.culprit}>{issue.culprit}</Subtitle>
                </Fragment>
              </TitleWithLink>
            </Title>
            {issue.issue_short_id && (
              <ShortId
                shortId={issue.issue_short_id}
                avatar={
                  project && <ProjectBadge project={project} hideName avatarSize={12} />
                }
              />
            )}
          </IssueSummary>
        );
      })}
      {organization.features.includes('anr-analyze-frames') && renderAnrCulprit()}
    </EventDataSection>
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
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  font-weight: 300;
  color: ${p => p.theme.subText};
`;

const TitleWithLink = styled(GlobalSelectionLink)`
  display: flex;
  font-weight: 600;
`;

const Title = styled('div')`
  line-height: 1;
  margin-bottom: ${space(0.5)};
`;

const StackTraceWrapper = styled('div')`
  margin-top: ${space(2)};
`;
