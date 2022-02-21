import * as React from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Button from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {PanelItem} from 'sentry/components/panels';
import Tag from 'sentry/components/tag';
import {IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AuthProvider} from 'sentry/types';
import {FeatureDisabledHooks} from 'sentry/types/hooks';
import {descopeFeatureName} from 'sentry/utils';

type RenderInstallButtonProps = {
  hasFeature: boolean;
  /**
   * We pass the provider so that it may be passed into any hook provided
   * callbacks.
   */
  provider: AuthProvider;
};

type LockedFeatureProps = {
  features: string[];
  provider: AuthProvider;
  className?: string;
};

type FeatureRenderProps = {
  features: string[];
  hasFeature: boolean;
  renderDisabled: (p: LockedFeatureProps) => React.ReactNode;
  renderInstallButton: (p: RenderInstallButtonProps) => React.ReactNode;
  children?: (p: FeatureRenderProps) => React.ReactNode;
};

type Props = {
  active: boolean;
  provider: AuthProvider;
  onConfigure?: (providerKey: string, e: React.MouseEvent) => void;
};

const ProviderItem = ({provider, active, onConfigure}: Props) => {
  const handleConfigure = (e: React.MouseEvent) => {
    onConfigure?.(provider.key, e);
  };

  const renderDisabledLock = (p: LockedFeatureProps) => (
    <LockedFeature provider={p.provider} features={p.features} />
  );

  const defaultRenderInstallButton = ({hasFeature}: RenderInstallButtonProps) => (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Button
          type="submit"
          name="provider"
          size="small"
          value={provider.key}
          disabled={!hasFeature || !hasAccess}
          onClick={handleConfigure}
        >
          {t('Configure')}
        </Button>
      )}
    </Access>
  );

  // TODO(epurkhiser): We should probably use a more explicit hook name,
  // instead of just the feature names (sso-basic, sso-saml2, etc).
  const featureKey = provider.requiredFeature;
  const hookName = featureKey
    ? (`feature-disabled:${descopeFeatureName(featureKey)}` as keyof FeatureDisabledHooks)
    : null;

  const featureProps = hookName ? {hookName} : {};

  const getProviderDescription = providerName => {
    if (providerName === 'SAML2') {
      return t(
        'your preferred SAML2 compliant provider like Ping Identity, Google SAML, Keycloak, or VMware Identity Manager'
      );
    }

    if (providerName === 'Google') {
      return t('Google (OAuth)');
    }

    return providerName;
  };

  return (
    <Feature
      {...featureProps}
      features={[featureKey].filter(f => f)}
      renderDisabled={({children, ...props}) =>
        typeof children === 'function' &&
        // TODO(ts): the Feature component isn't correctly templatized to allow
        // for custom props in the renderDisabled function
        children({...props, renderDisabled: renderDisabledLock as any})
      }
    >
      {({
        hasFeature,
        features,
        renderDisabled,
        renderInstallButton,
      }: FeatureRenderProps) => (
        <PanelItem center>
          <ProviderInfo>
            <ProviderLogo
              className={`provider-logo ${provider.name
                .replace(/\s/g, '-')
                .toLowerCase()}`}
            />
            <div>
              <ProviderName>{provider.name}</ProviderName>
              <ProviderDescription>
                {t(
                  'Enable your organization to sign in with %s.',
                  getProviderDescription(provider.name)
                )}
              </ProviderDescription>
            </div>
          </ProviderInfo>

          <FeatureBadge>
            {!hasFeature && renderDisabled({provider, features})}
          </FeatureBadge>

          <div>
            {active ? (
              <ActiveIndicator />
            ) : (
              (renderInstallButton ?? defaultRenderInstallButton)({provider, hasFeature})
            )}
          </div>
        </PanelItem>
      )}
    </Feature>
  );
};

export default ProviderItem;

const ProviderInfo = styled('div')`
  flex: 1;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(2)};
`;

const ProviderLogo = styled('div')`
  height: 36px;
  width: 36px;
  border-radius: 3px;
  margin-right: 0;
  top: auto;
`;

const ProviderName = styled('div')`
  font-weight: bold;
`;

const ProviderDescription = styled('div')`
  margin-top: ${space(0.75)};
  font-size: 0.8em;
`;

const FeatureBadge = styled('div')`
  flex: 1;
`;

const ActiveIndicator = styled('div')`
  background: ${p => p.theme.green300};
  color: ${p => p.theme.white};
  padding: ${space(1)} ${space(1.5)};
  border-radius: 2px;
  font-size: 0.8em;
`;

ActiveIndicator.defaultProps = {
  children: t('Active'),
};

const DisabledHovercard = styled(Hovercard)`
  width: 350px;
`;

const LockedFeature = ({provider, features, className}: LockedFeatureProps) => (
  <DisabledHovercard
    containerClassName={className}
    body={
      <FeatureDisabled
        features={features}
        hideHelpToggle
        message={t('%s SSO is disabled.', provider.name)}
        featureName={t('SSO Auth')}
      />
    }
  >
    <Tag icon={<IconLock />}>{t('disabled')}</Tag>
  </DisabledHovercard>
);
