import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import GroupEventAttachments from './groupEventAttachments';

function GroupEventAttachmentsContainer() {
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const params = useParams();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  if (isGroupPending) {
    return <LoadingIndicator />;
  }

  if (isGroupError) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return (
    <Feature
      features="event-attachments"
      organization={organization}
      renderDisabled={props => (
        <FeatureDisabled {...props} featureName={t('Event Attachments')} />
      )}
    >
      <StyledLayoutBody hasStreamlinedUI={hasStreamlinedUI}>
        <Layout.Main fullWidth>
          <GroupEventAttachments project={group.project} groupId={group.id} />
        </Layout.Main>
      </StyledLayoutBody>
    </Feature>
  );
}

const StyledLayoutBody = styled(Layout.Body)<{hasStreamlinedUI?: boolean}>`
  ${p =>
    p.hasStreamlinedUI &&
    css`
      border: 1px solid ${p.theme.border};
      border-radius: ${p.theme.borderRadius};
      padding: ${space(2)} 0;

      @media (min-width: ${p.theme.breakpoints.medium}) {
        padding: ${space(2)} ${space(2)};
      }
    `}
`;

export default GroupEventAttachmentsContainer;
