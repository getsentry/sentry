import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';

import type {
  EditOwnershipRulesModalOptions,
  ModalRenderProps,
} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {EditOwnershipRules} from 'sentry/views/settings/project/projectOwnership/editRulesModal';

type Props = ModalRenderProps & EditOwnershipRulesModalOptions;

function EditOwnershipRulesModal({Body, Header, onSave, closeModal, ...props}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Edit Ownership Rules')}</h4>
      </Header>
      <Body>
        <EditOwnershipRules {...props} onSave={onSave} onCancel={closeModal} />
      </Body>
    </Fragment>
  );
}

export const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
  }
  [role='document'] {
    overflow: initial;
  }
`;

export default EditOwnershipRulesModal;
