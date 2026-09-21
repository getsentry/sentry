import styled from '@emotion/styled';

import {
  SpanProfileDetails,
  useSpanProfileDetails,
  type SpanProfileDetailsContext,
  type SpanProfileDetailsProps,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

export function ProfileDetails({
  organization,
  context,
  span,
}: {
  context: SpanProfileDetailsContext;
  organization: Organization;
  span: Readonly<SpanProfileDetailsProps['span']>;
}) {
  const {profile, frames} = useSpanProfileDetails(organization, context, span);

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
        <SpanProfileDetails context={context} span={span} />
      </EmbededContentWrapper>
    </FoldSection>
  );
}

const EmbededContentWrapper = styled('div')`
  margin-top: ${p => p.theme.space.xs};
`;
