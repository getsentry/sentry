import {Fragment} from 'react';
import {css} from '@emotion/react';

import {EditOwnershipRulesModalOptions, ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import theme from 'app/utils/theme';
import OwnershipModal from 'app/views/settings/project/projectOwnership/editRulesModal';

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
  @media (min-width: ${theme.breakpoints[0]}) {
    width: 80%;
  }
  [role='document'] {
    overflow: initial;
  }
`;

export default EditOwnershipRulesModal;
