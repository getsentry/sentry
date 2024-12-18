import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import AddTempestCredentialsForm from 'sentry/views/settings/project/tempest/addTempestCredentialsForm';

interface Props extends ModalRenderProps {
  organization: Organization;
  project: Project;
}

export default function AddCredentialsModal({Body, Header, ...props}: Props) {
  const {organization, project} = props;

  return (
    <Fragment>
      <Header closeButton>{t('Add New Credentials')}</Header>
      <Body>
        <AddTempestCredentialsForm
          {...props}
          organization={organization}
          project={project}
        />
      </Body>
    </Fragment>
  );
}
