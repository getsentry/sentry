import {Fragment} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {t} from 'sentry/locale';
import type {CustomRepo, CustomRepoFormData} from 'sentry/types/debugFiles';
import {CustomRepoType} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';

import {Http} from './http';
import {GcsRepository, S3Repository} from './objectStorage';

type Props = {
  /**
   * Callback invoked with the updated config value.
   */
  onSave: (data: CustomRepoFormData) => Promise<void>;
  organization: Organization;
  /**
   * Type of this source.
   */
  sourceType: CustomRepoType;
  /**
   * The sourceConfig. May be empty to create a new one.
   */
  sourceConfig?: CustomRepo;
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
  function handleSave(data: CustomRepoFormData) {
    return onSave(data)
      .then(() => {
        closeModal();
      })
      .catch(() => {});
  }

  return (
    <Feature organization={organization} features="custom-symbol-sources">
      {({hasFeature, features}) => {
        if (hasFeature) {
          const commonProps = {Header, Body, Footer, onSubmit: handleSave};

          switch (sourceType) {
            case CustomRepoType.HTTP:
              return (
                <Http
                  {...commonProps}
                  initialData={
                    sourceConfig?.type === CustomRepoType.HTTP ? sourceConfig : undefined
                  }
                />
              );
            case CustomRepoType.S3:
              return (
                <S3Repository
                  {...commonProps}
                  sourceConfig={
                    sourceConfig?.type === CustomRepoType.S3 ? sourceConfig : undefined
                  }
                />
              );
            case CustomRepoType.GCS:
              return (
                <GcsRepository
                  {...commonProps}
                  sourceConfig={
                    sourceConfig?.type === CustomRepoType.GCS ? sourceConfig : undefined
                  }
                />
              );
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
