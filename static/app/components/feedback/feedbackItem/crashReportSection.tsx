import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';

import {useFetchCrashReport} from 'sentry/components/feedback/feedbackItem/useFetchCrashReport';
import {GroupHeaderRow} from 'sentry/components/groupHeaderRow';
import {GroupMetaRow} from 'sentry/components/groupMetaRow';
import {Placeholder} from 'sentry/components/placeholder';
import {tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

interface Props {
  crashReportId: string;
  organization: Organization;
  projectSlug: string;
}

export function CrashReportSection({crashReportId, organization, projectSlug}: Props) {
  const {isFetching, groupData} = useFetchCrashReport({
    crashReportId,
    organization,
    projectSlug,
  });

  useEffect(() => {
    if (!groupData) {
      trackAnalytics('feedback.no_associated_event_found', {
        orgSlug: organization.slug,
        organization,
      });
    }
  }, [organization, groupData]);

  if (isFetching) {
    return <Placeholder height="92px" />;
  }

  if (!groupData) {
    return (
      <Alert variant="warning">
        {tct(
          'Event [id] was linked but not found in this project. The event might have been dropped or the ID may be incorrect.',
          {id: crashReportId}
        )}
      </Alert>
    );
  }

  return (
    <IssueDetailsContainer>
      <GroupHeaderRow eventId={crashReportId} data={groupData} />
      <GroupMetaRow data={groupData} />
    </IssueDetailsContainer>
  );
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg} ${p => p.theme.space.lg}
    ${p => p.theme.space.xl};
  overflow: auto;
`;
