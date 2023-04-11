import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ShortId from 'sentry/components/group/inboxBadges/shortId';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useProjects from 'sentry/utils/useProjects';

enum AnrRootCauseAllowlist {
  PerformanceFileIOMainThreadGroupType = 1008,
  PerformanceDBMainThreadGroupType = 1013,
}

interface Props {
  event: Event;
  organization: Organization;
}

export function AnrRootCause({organization}: Props) {
  const quickTrace = useContext(QuickTraceContext);
  const {projects} = useProjects();

  if (
    !quickTrace ||
    quickTrace.error ||
    quickTrace.trace === null ||
    quickTrace.trace.length === 0 ||
    quickTrace.trace[0]?.performance_issues?.length === 0
  ) {
    return null;
  }

  const potentialAnrRootCause = quickTrace.trace[0].performance_issues.filter(issue =>
    Object.values(AnrRootCauseAllowlist).includes(issue.type as AnrRootCauseAllowlist)
  );

  if (potentialAnrRootCause.length === 0) {
    return null;
  }

  return (
    <EventDataSection
      title={t('Suspect Root Issues')}
      type="suspect-root-issues"
      help={t(
        'Suspect Root Issues identifies potential Performance Issues that may be contributing to this ANR.'
      )}
    >
      {potentialAnrRootCause.map(issue => {
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
