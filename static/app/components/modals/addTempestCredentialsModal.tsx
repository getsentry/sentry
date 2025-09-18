import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import AddTempestCredentialsForm from 'sentry/views/settings/project/tempest/addTempestCredentialsForm';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';

interface Props extends ModalRenderProps {
  organization: Organization;
  origin: 'onboarding' | 'project-creation' | 'project-settings';
  project: Project;
}

export default function AddCredentialsModal({Body, Header, ...props}: Props) {
  const {closeModal, organization, project, origin} = props;
  const {invalidateCredentialsCache} = useFetchTempestCredentials(organization, project);

  const onSuccess = () => {
    addSuccessMessage(t('Credentials submitted successfully'));
    invalidateCredentialsCache();
    closeModal();
    trackAnalytics('tempest.credentials.added', {
      organization,
      project_slug: project.slug,
      origin,
    });
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
