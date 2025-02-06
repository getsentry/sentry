import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import AddTempestCredentialsForm from 'sentry/views/settings/project/tempest/addTempestCredentialsForm';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';

interface Props extends ModalRenderProps {
  organization: Organization;
  project: Project;
}

export default function AddCredentialsModal({Body, Header, ...props}: Props) {
  const {closeModal, organization, project} = props;
  const {invalidateCredentialsCache} = useFetchTempestCredentials(organization, project);

  const onSuccess = () => {
    invalidateCredentialsCache();
    closeModal();
  };

  return (
    <Fragment>
      <Header closeButton>{t('Add New Credentials')}</Header>
      <Body>
        <AddTempestCredentialsForm
          {...props}
          organization={organization}
          project={project}
          onSuccess={onSuccess}
        />
      </Body>
    </Fragment>
  );
}
