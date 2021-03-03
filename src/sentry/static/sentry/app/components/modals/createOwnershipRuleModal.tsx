import React from 'react';
import {css} from '@emotion/core';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import theme from 'app/utils/theme';
import ProjectOwnershipModal from 'app/views/settings/project/projectOwnership/modal';

type Props = ModalRenderProps &
  Pick<ProjectOwnershipModal['props'], 'organization' | 'project' | 'issueId'> & {
    onClose?: () => void;
  };

const CreateOwnershipRuleModal = ({Body, Header, closeModal, ...props}: Props) => {
  const handleSuccess = () => {
    props.onClose?.();
    window.setTimeout(closeModal, 2000);
  };

  return (
    <React.Fragment>
      <Header closeButton onHide={closeModal}>
        {t('Create Ownership Rule')}
      </Header>
      <Body>
        <ProjectOwnershipModal {...props} onSave={handleSuccess} />
      </Body>
    </React.Fragment>
  );
};

export const modalCss = css`
  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 80%;
      margin-left: -40%;
    }
  }
  .modal-content {
    overflow: initial;
  }
`;

export default CreateOwnershipRuleModal;
