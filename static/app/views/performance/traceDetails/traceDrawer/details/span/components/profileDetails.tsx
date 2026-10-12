import styled from '@emotion/styled';

import {
  SpanProfileDetails,
  useSpanProfileDetails,
  type SpanProfileDetailsMetadata,
  type SpanProfileDetailsProps,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

export function ProfileDetails({
  organization,
  metadata,
  span,
}: {
  metadata: SpanProfileDetailsMetadata;
  organization: Organization;
  span: Readonly<SpanProfileDetailsProps['span']>;
}) {
  const {profile, frames} = useSpanProfileDetails(organization, metadata, span);

  if (!defined(profile) || frames.length === 0) {
    return null;
  }

  return (
    <FoldSection
      sectionKey="span_profile_details"
      title={t('Profile')}
      disableCollapsePersistence
    >
      <EmbededContentWrapper>
        <SpanProfileDetails metadata={metadata} span={span} />
      </EmbededContentWrapper>
    </FoldSection>
  );
}

const EmbededContentWrapper = styled('div')`
  margin-top: ${p => p.theme.space.xs};
`;
