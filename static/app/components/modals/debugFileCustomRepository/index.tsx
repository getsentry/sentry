import {Fragment} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {getDebugSourceName} from 'sentry/data/debugFileSources';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {AppStoreConnectStatusData, CustomRepoType} from 'sentry/types/debugFiles';
import {useParams} from 'sentry/utils/useParams';

import AppStoreConnect from './appStoreConnect';
import Http from './http';
import {getFinalData, getFormFieldsAndInitialData} from './utils';

type AppStoreConnectInitialData = React.ComponentProps<
  typeof AppStoreConnect
>['initialData'];

type HttpInitialData = React.ComponentProps<typeof Http>['initialData'];

type RouteParams = {
  projectId: string;
};

type Props = {
  appStoreConnectSourcesQuantity: number;
  /**
   * Callback invoked with the updated config value.
   */
  onSave: (data: Record<string, any>) => Promise<void>;
  organization: Organization;
  /**
   * Type of this source.
   */
  sourceType: CustomRepoType;

  appStoreConnectStatusData?: AppStoreConnectStatusData;
  /**
   * The sourceConfig. May be empty to create a new one.
   */
  sourceConfig?: Record<string, any>;
} & Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer' | 'closeModal' | 'CloseButton'>;

const HookedAppStoreConnectMultiple = HookOrDefault({
  hookName: 'component:disabled-app-store-connect-multiple',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const HookedCustomSymbolSources = HookOrDefault({
  hookName: 'component:disabled-custom-symbol-sources',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function DebugFileCustomRepository({
  Header,
  Body,
  Footer,
  CloseButton,
  onSave,
  sourceConfig,
  sourceType,
  appStoreConnectStatusData,
  closeModal,
  organization,
  appStoreConnectSourcesQuantity,
}: Props) {
  const {projectId: projectSlug} = useParams<RouteParams>();
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
      <Feature organization={organization} features="app-store-connect-multiple">
        {({hasFeature, features}) => {
          if (
            hasFeature ||
            (appStoreConnectSourcesQuantity === 1 && sourceConfig) ||
            appStoreConnectSourcesQuantity === 0
          ) {
            return (
              <AppStoreConnect
                Header={Header}
                Body={Body}
                Footer={Footer}
                orgSlug={organization.slug}
                projectSlug={projectSlug}
                onSubmit={handleSave}
                initialData={sourceConfig as AppStoreConnectInitialData}
                appStoreConnectStatusData={appStoreConnectStatusData}
              />
            );
          }

          return (
            <Fragment>
              <CloseButton />
              <HookedAppStoreConnectMultiple organization={organization}>
                <FeatureDisabled
                  features={features}
                  featureName={t('App Store Connect Multiple')}
                  hideHelpToggle
                />
              </HookedAppStoreConnectMultiple>
            </Fragment>
          );
        }}
      </Feature>
    );
  }

  return (
    <Feature organization={organization} features="custom-symbol-sources">
      {({hasFeature, features}) => {
        if (hasFeature) {
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

          const {initialData, fields} = getFormFieldsAndInitialData(
            sourceType,
            sourceConfig
          );

          return (
            <Fragment>
              <Header closeButton>
                {sourceConfig
                  ? tct('Update [name] Repository', {
                      name: getDebugSourceName(sourceType),
                    })
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
                    <FieldFromConfig
                      key={field.name || i}
                      field={field}
                      inline={false}
                      stacked
                    />
                  ))}
                </Form>
              )}
            </Fragment>
          );
        }

        return (
          <Fragment>
            <CloseButton />
            <HookedCustomSymbolSources organization={organization}>
              <FeatureDisabled
                features={features}
                featureName={t('Custom Symbol Sources')}
                hideHelpToggle
              />
            </HookedCustomSymbolSources>
          </Fragment>
        );
      }}
    </Feature>
  );
}

export default DebugFileCustomRepository;

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;
