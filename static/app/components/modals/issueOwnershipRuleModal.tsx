import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Event, Organization, Project} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import theme from 'sentry/utils/theme';
import ProjectOwnershipModal from 'sentry/views/settings/project/projectOwnership/modal';

interface CreateOwnershipRuleProps extends ModalRenderProps {
  issueId: string;
  organization: Organization;
  project: Project;
  eventData?: Event;
}

function IssueOwnershipRuleModal({
  Body,
  Header,
  Footer: _Footer,
  organization,
  project,
  issueId,
  eventData,
  closeModal,
}: CreateOwnershipRuleProps) {
  useEffect(() => {
    trackIntegrationAnalytics('project_ownership.modal_opened', {
      page: 'issue_details',
      organization,
    });
  }, [organization]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Edit Ownership Rules')}</h4>
      </Header>
      <Body>
        <ProjectOwnershipModal
          organization={organization}
          project={project}
          issueId={issueId}
          eventData={eventData}
          onCancel={closeModal}
        />
      </Body>
    </Fragment>
  );
}

export const modalCss = css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
  }
`;

export default IssueOwnershipRuleModal;
