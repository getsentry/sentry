import {useCallback, useEffect, useRef} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import {Button} from 'sentry/components/core/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

function SelectProjectRedirect() {
  const navigate = useNavigate();
  const params = useParams<{orgId: string; subpage: string}>();
  const subpage = params.subpage ?? '';
  const hasOpenedModal = useRef(false);

  const basePath = params.orgId
    ? `/settings/${params.orgId}/projects/:projectId/`
    : `/settings/projects/:projectId/`;

  const handleOpenModal = useCallback(() => {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={`${basePath}${subpage}`}
          needOrg={false}
          needProject
          onFinish={path => {
            modalProps.closeModal();
            return window.setTimeout(() => navigate(path as string), 0);
          }}
        />
      ),
      {}
    );
  }, [navigate, subpage, basePath]);

  useEffect(() => {
    if (hasOpenedModal.current) {
      return;
    }
    hasOpenedModal.current = true;
    handleOpenModal();
  }, [handleOpenModal]);

  return (
    <Flex justify="center" align="center" flex="1">
      <EmptyMessage
        icon={<IconProject size="xl" />}
        title={t('Select a Project')}
        action={
          <Button priority="primary" onClick={handleOpenModal}>
            {t('Choose Project')}
          </Button>
        }
      >
        {t('Choose a project to navigate to its settings.')}
      </EmptyMessage>
    </Flex>
  );
}

export default SelectProjectRedirect;
