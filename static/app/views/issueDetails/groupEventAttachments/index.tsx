import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{groupId: string}, {}> & {
  group: Group;
};

function GroupEventAttachmentsContainer({group}: Props) {
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();

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
