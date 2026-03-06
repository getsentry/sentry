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

import GroupEventAttachments from './groupEventAttachments';

function GroupEventAttachmentsContainer() {
  const organization = useOrganization();
  const params = useParams();

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId!});

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
      <StyledLayoutBody>
        <Layout.Main width="full">
          <GroupEventAttachments project={group.project} group={group} />
        </Layout.Main>
      </StyledLayoutBody>
    </Feature>
  );
}

const StyledLayoutBody = styled(Layout.Body)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(2)} 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)} ${space(2)};
  }
`;

export default GroupEventAttachmentsContainer;
