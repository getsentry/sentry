import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import {getDebugSourceName} from 'app/data/debugFileSources';
import {t, tct} from 'app/locale';
import {DebugFileSource, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';

import AppStoreConnect from './appStoreConnect';
import {getFormFields} from './utils';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = WithRouterProps<RouteParams, {}> & {
  api: Client;
  /**
   * Callback invoked with the updated config value.
   */
  onSave: (config: Record<string, string>) => void;
  /**
   * Type of this source.
   */
  sourceType: DebugFileSource;
  /**
   * The sourceConfig. May be empty to create a new one.
   */
  sourceConfig?: Record<string, string>;
} & ModalRenderProps;

function DebugFileCustomRepository({
  closeModal,
  Header,
  Body,
  Footer,
  onSave,
  sourceConfig,
  sourceType,
  params: {orgId, projectId},
  api,
}: Props) {
  function handleSave(data?: Record<string, string>) {
    if (!data) {
      fetchProject();
      return;
    }
    onSave({...data, type: sourceType});
    closeModal();
  }

  async function fetchProject() {
    try {
      const updatedProject: Project = await api.requestPromise(
        `/projects/${orgId}/${projectId}/`
      );
      ProjectActions.updateSuccess(updatedProject);
      onSave({});
      closeModal();
    } catch {
      addErrorMessage(t('An error occured while fetching project data'));
    }
  }

  function renderForm() {
    if (sourceType === 'appStoreConnect') {
      return (
        <AppStoreConnect
          Body={Body}
          Footer={Footer}
          closeModal={closeModal}
          orgSlug={orgId}
          projectSlug={projectId}
          onSubmit={handleSave}
        />
      );
    }

    const fields = getFormFields(sourceType);

    if (!fields) {
      return null;
    }

    return (
      <Form
        allowUndo
        requireChanges
        initialData={sourceConfig}
        onSubmit={handleSave}
        footerClass="modal-footer"
      >
        {fields.map((field, i) => (
          <FieldFromConfig key={field.name || i} field={field} inline={false} stacked />
        ))}
      </Form>
    );
  }

  const headerText = sourceConfig ? 'Update [name] Repository' : 'Add [name] Repository';

  return (
    <React.Fragment>
      <Header closeButton onHide={closeModal}>
        {tct(headerText, {name: getDebugSourceName(sourceType)})}
      </Header>
      {renderForm()}
    </React.Fragment>
  );
}

export default withRouter(withApi(DebugFileCustomRepository));
