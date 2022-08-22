import {Fragment} from 'react';
import {css} from '@emotion/react';

import {
  EditOwnershipRulesModalOptions,
  ModalRenderProps,
} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import theme from 'sentry/utils/theme';
import OwnershipModal from 'sentry/views/settings/project/projectOwnership/editRulesModal';

type Props = ModalRenderProps & EditOwnershipRulesModalOptions;

const EditOwnershipRulesModal = ({Body, Header, onSave, ...props}: Props) => {
  return (
    <Fragment>
      <Header closeButton>{t('Edit Ownership Rules')}</Header>
      <Body>
        <OwnershipModal {...props} onSave={onSave} />
      </Body>
    </Fragment>
  );
};

export const modalCss = css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
  }
  [role='document'] {
    overflow: initial;
  }
`;

export default EditOwnershipRulesModal;
