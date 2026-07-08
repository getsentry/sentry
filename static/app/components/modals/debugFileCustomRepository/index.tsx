import {Fragment} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {t} from 'sentry/locale';
import {CustomRepoType} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';

import {Http} from './http';
import {GcsRepository, S3Repository} from './objectStorage';
import {getFinalData} from './utils';

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

const HookedCustomSymbolSources = OverrideOrDefault({
  overrideName: 'component:disabled-custom-symbol-sources',
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
          const commonProps = {Header, Body, Footer, onSubmit: handleSave};

          switch (sourceType) {
            case CustomRepoType.HTTP:
              return (
                <Http {...commonProps} initialData={sourceConfig as HttpInitialData} />
              );
            case CustomRepoType.S3:
              return <S3Repository {...commonProps} sourceConfig={sourceConfig} />;
            case CustomRepoType.GCS:
              return <GcsRepository {...commonProps} sourceConfig={sourceConfig} />;
            default:
              return null;
          }
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
