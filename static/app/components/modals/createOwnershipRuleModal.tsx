import {Fragment, useCallback, useEffect, useRef} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import theme from 'sentry/utils/theme';
import ProjectOwnershipModal from 'sentry/views/settings/project/projectOwnership/modal';

type Props = ModalRenderProps &
  Pick<ProjectOwnershipModal['props'], 'organization' | 'project' | 'issueId'> & {
    onClose?: () => void;
  };

const CreateOwnershipRuleModal = ({
  Body,
  Header,
  closeModal,
  onClose,
  Footer: _Footer,
  CloseButton: _CloseButton,
  ...props
}: Props) => {
  const closeModalTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearInterval(closeModalTimeoutRef.current);
    };
  }, []);

  const handleSuccess = useCallback(() => {
    onClose?.();
    window.clearTimeout(closeModalTimeoutRef.current);
    closeModalTimeoutRef.current = window.setTimeout(closeModal, 2000);
  }, [onClose, closeModal]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Create Ownership Rule')}</h4>
      </Header>
      <Body>
        <ProjectOwnershipModal {...props} onSave={handleSuccess} />
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

export default CreateOwnershipRuleModal;
