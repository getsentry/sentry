import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import SentryTypes from 'app/sentryTypes';
import {IconLock} from 'app/icons';
import Tag from 'app/components/tag-deprecated';
import {descopeFeatureName} from 'app/utils';

export default class ProviderItem extends React.PureComponent {
  static propTypes = {
    provider: SentryTypes.AuthProvider.isRequired,
    onConfigure: PropTypes.func.isRequired,
    active: PropTypes.bool,
  };

  static defaultProps = {
    onConfigure: () => {},
  };

  handleConfigure = e => {
    this.props.onConfigure(this.props.provider.key, e);
  };

  renderDisabledLock = p => <LockedFeature provider={p.provider} features={p.features} />;

  renderInstallButton = ({provider, hasFeature}) => (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Button
          type="submit"
          name="provider"
          size="small"
          value={provider.key}
          disabled={!hasFeature || !hasAccess}
          onClick={this.handleConfigure}
        >
          {t('Configure')}
        </Button>
      )}
    </Access>
  );

  render() {
    const {provider, active} = this.props;

    // TODO(epurkhiser): We should probably use a more explicit hook name,
    // instead of just the feature names (sso-basic, sso-saml2, etc).
    const featureKey = provider.requiredFeature;
    const featureProps = featureKey
      ? {hookName: `feature-disabled:${descopeFeatureName(featureKey)}`}
      : {};

    return (
      <Feature
        {...featureProps}
        features={[featureKey].filter(f => f)}
        renderDisabled={({children, ...props}) =>
          children({...props, renderDisabled: this.renderDisabledLock})
        }
      >
        {({hasFeature, features, renderDisabled, renderInstallButton}) => (
          <PanelItem alignItems="center">
            <ProviderInfo>
              <ProviderLogo
                className={`provider-logo ${provider.name
                  .replace(/\s/g, '')
                  .toLowerCase()}`}
              />
              <div>
                <ProviderName>{provider.name}</ProviderName>
                <ProviderDescription>
                  {t('Enable your organization to sign in with %s.', provider.name)}
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
                (renderInstallButton || this.renderInstallButton)({provider, hasFeature})
              )}
            </div>
          </PanelItem>
        )}
      </Feature>
    );
  }
}

const ProviderInfo = styled('div')`
  flex: 1;
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(2)};
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
  margin-top: 6px;
  font-size: 0.8em;
`;

const FeatureBadge = styled('div')`
  flex: 1;
`;

const ActiveIndicator = styled(p => <div className={p.className}>{t('Active')}</div>)`
  background: ${p => p.theme.green400};
  color: #fff;
  padding: 8px 12px;
  border-radius: 2px;
  font-size: 0.8em;
`;

const DisabledHovercard = styled(Hovercard)`
  width: 350px;
`;

const LockedFeature = ({provider, features, className}) => (
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
    <Tag icon={<IconLock size="xs" />}>disabled</Tag>
  </DisabledHovercard>
);

LockedFeature.propTypes = {
  provider: PropTypes.object.isRequired,
  features: PropTypes.arrayOf(PropTypes.string).isRequired,
};
