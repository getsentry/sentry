import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import {Location} from 'history';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
import {getDebugSourceName} from 'app/data/debugFileSources';
import {tct} from 'app/locale';
import {CustomRepoType} from 'app/types/debugFiles';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';

import AppStoreConnect from './appStoreConnect';
import {getFormFields, getInitialData} from './utils';

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
  onSave: (data: Record<string, any>) => Promise<void>;
  /**
   * Type of this source.
   */
  sourceType: CustomRepoType;

  appStoreConnectContext?: AppStoreConnectContextProps;
  /**
   * The sourceConfig. May be empty to create a new one.
   */
  sourceConfig?: Record<string, any>;
} & Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer' | 'closeModal'>;

function DebugFileCustomRepository({
  Header,
  Body,
  Footer,
  onSave,
  sourceConfig,
  sourceType,
  params: {orgId, projectId: projectSlug},
  location,
  appStoreConnectContext,
  closeModal,
}: Props) {
  function handleSave(data: Record<string, any>) {
    onSave({...data, type: sourceType}).then(() => {
      closeModal();

      if (sourceType === CustomRepoType.APP_STORE_CONNECT) {
        window.location.reload();
      }
    });
  }

  if (sourceType === CustomRepoType.APP_STORE_CONNECT) {
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
  const initialData = getInitialData(sourceConfig);

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
          initialData={initialData}
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
