import {Fragment} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {getDebugSourceName} from 'sentry/data/debugFileSources';
import {t, tct} from 'sentry/locale';
import {CustomRepoType} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';

import Http from './http';
import {getFinalData, getFormFieldsAndInitialData} from './utils';

type HttpInitialData = React.ComponentProps<typeof Http>['initialData'];

type Props = {
  /**
   * Callback invoked with the updated config value.
   */
  onSave: (data: Record<string, any>) => Promise<void>;
  organization: Organization;
  /**
   * Type of this source.
   */
  sourceType: CustomRepoType;
  /**
   * The sourceConfig. May be empty to create a new one.
   */
  sourceConfig?: Record<string, any>;
} & Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer' | 'closeModal' | 'CloseButton'>;

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
  closeModal,
  organization,
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
                      key={field?.name || i}
                      // @ts-expect-error TS(2322): Type '(CustomType & BaseField) | ({ type: "select"... Remove this comment to see the full error message
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
