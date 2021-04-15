import React from 'react';
import {css} from '@emotion/core';

import {EditOwnershipRulesModalOptions, ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import theme from 'app/utils/theme';
import OwnershipModal from 'app/views/settings/project/projectOwnership/editRulesModal';

type Props = ModalRenderProps & EditOwnershipRulesModalOptions;

const EditOwnershipRulesModal = ({Body, Header, closeModal, onSave, ...props}: Props) => {
  return (
    <React.Fragment>
      <Header closeButton onHide={closeModal}>
        {t('Edit Ownership Rules')}
      </Header>
      <Body>
        <OwnershipModal {...props} onSave={onSave} />
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

  .modal-header {
    font-size: 20px;
    font-weight: bold;
  }
`;

export default EditOwnershipRulesModal;
