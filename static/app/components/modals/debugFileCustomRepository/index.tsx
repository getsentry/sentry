import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getDebugSourceName} from 'sentry/data/debugFileSources';
import {tct} from 'sentry/locale';
import {AppStoreConnectStatusData, CustomRepoType} from 'sentry/types/debugFiles';
import FieldFromConfig from 'sentry/views/settings/components/forms/fieldFromConfig';
import Form from 'sentry/views/settings/components/forms/form';

import AppStoreConnect from './appStoreConnect';
import Http from './http';
import {getFinalData, getFormFieldsAndInitialData} from './utils';

type AppStoreConnectInitialData = React.ComponentProps<
  typeof AppStoreConnect
>['initialData'];

type HttpInitialData = React.ComponentProps<typeof Http>['initialData'];

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

  appStoreConnectStatusData?: AppStoreConnectStatusData;
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
  appStoreConnectStatusData,
  closeModal,
}: Props) {
  function handleSave(data?: Record<string, any>) {
    if (!data) {
      closeModal();
      window.location.reload();
      return;
    }

    onSave({...getFinalData(sourceType, data), type: sourceType}).then(() => {
      closeModal();
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
        initialData={sourceConfig as AppStoreConnectInitialData}
        appStoreConnectStatusData={appStoreConnectStatusData}
      />
    );
  }

  if (sourceType === CustomRepoType.HTTP) {
    return (
      <Http
        Header={Header}
        Body={Body}
        Footer={Footer}
        onSubmit={handleSave}
        initialData={sourceConfig as HttpInitialData}
      />
    );
  }

  const {initialData, fields} = getFormFieldsAndInitialData(sourceType, sourceConfig);

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
