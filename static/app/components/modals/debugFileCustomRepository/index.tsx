import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import {Location} from 'history';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
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

  appStoreConnectContext?: AppStoreConnectContextProps;
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
  params: {orgId, projectId: projectSlug},
  location,
  appStoreConnectContext,
}: Props) {
  function handleSave(data: Record<string, string>) {
    onSave({...data, type: sourceType});
    closeModal();
  }

  if (sourceType === 'appStoreConnect') {
    return (
      <AppStoreConnect
        Header={Header}
        Body={Body}
        Footer={Footer}
        orgSlug={orgId}
        projectSlug={projectSlug}
        onSubmit={handleSave}
        initialData={sourceConfig as AppStoreConnectInitialData | undefined}
        location={location as Location}
        appStoreConnectContext={appStoreConnectContext}
      />
    );
  }

  const fields = getFormFields(sourceType);

  return (
    <Fragment>
      <Header closeButton>
        {sourceConfig
          ? tct('Update [name] Repository', {name: getDebugSourceName(sourceType)})
          : tct('Add [name] Repository', {name: getDebugSourceName(sourceType)})}
      </Header>
      {fields && (
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
      )}
    </Fragment>
  );
}

export default withRouter(DebugFileCustomRepository);

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
