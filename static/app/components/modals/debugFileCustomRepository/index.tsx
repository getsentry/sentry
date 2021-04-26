import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import ErrorBoundary from 'app/components/errorBoundary';
import {getDebugSourceName} from 'app/data/debugFileSources';
import {tct} from 'app/locale';
import {DebugFileSource} from 'app/types';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';

import AppStoreConnect from './appStoreConnect';
import {getFormFields} from './utils';

type AppStoreConnectInitialData = React.ComponentProps<
  typeof AppStoreConnect
>['initialData'];

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = WithRouterProps<RouteParams, {}> & {
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
}: Props) {
  function handleSave(data: Record<string, string>) {
    onSave({...data, type: sourceType});
    closeModal();
  }

  function renderForm() {
    if (sourceType === 'appStoreConnect') {
      return (
        <ErrorBoundary>
          <AppStoreConnect
            Body={Body}
            Footer={Footer}
            closeModal={closeModal}
            orgSlug={orgId}
            projectSlug={projectId}
            onSubmit={handleSave}
            initialData={sourceConfig as AppStoreConnectInitialData | undefined}
          />
        </ErrorBoundary>
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
      <Header closeButton>
        {tct(headerText, {name: getDebugSourceName(sourceType)})}
      </Header>
      {renderForm()}
    </React.Fragment>
  );
}

export default withRouter(DebugFileCustomRepository);

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
