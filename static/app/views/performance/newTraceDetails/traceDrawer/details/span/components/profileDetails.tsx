import styled from '@emotion/styled';

import {
  SpanProfileDetails,
  useSpanProfileDetails,
  type SpanProfileDetailsProps,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function ProfileDetails({
  organization,
  project,
  event,
  span,
}: {
  event: Readonly<EventTransaction>;
  organization: Organization;
  project: Project | undefined;
  span: Readonly<SpanProfileDetailsProps['span']>;
}) {
  const {profile, frames} = useSpanProfileDetails(organization, project, event, span);

  if (!defined(profile) || frames.length === 0) {
    return null;
  }

  return (
    <InterimSection
      title={t('Profile')}
      type="span_profile_details"
      disableCollapsePersistence
    >
      <EmbededContentWrapper>
        <SpanProfileDetails span={span} event={event} />
      </EmbededContentWrapper>
    </InterimSection>
  );
}

const EmbededContentWrapper = styled('div')`
  margin-top: ${space(0.5)};
`;
