import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  crashReportId: string;
  organization: Organization;
  projSlug: string;
}

export default function CrashReportSection({
  crashReportId,
  organization,
  projSlug,
}: Props) {
  const endpoint = `/projects/${organization.slug}/${projSlug}/events/${crashReportId}/`;
  const {data: crashReportData} = useApiQuery<Event>([endpoint], {staleTime: 0});
  return crashReportData ? (
    <Section icon={<IconIssues size="xs" />} title={t('Linked Issue')}>
      <ErrorBoundary mini>
        <IssueDetailsContainer>
          <EventOrGroupHeader
            organization={organization}
            data={crashReportData}
            size="normal"
          />
          <EventOrGroupExtraDetails data={crashReportData} showInboxTime />
        </IssueDetailsContainer>
      </ErrorBoundary>
    </Section>
  ) : null;
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
`;
