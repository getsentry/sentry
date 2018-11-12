import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import SentryTypes from 'app/sentryTypes';
import Tag from 'app/views/settings/components/tag';

export default class ProviderItem extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    provider: PropTypes.object.isRequired,
    onConfigure: PropTypes.func.isRequired,
  };

  static defaultProps = {
    onConfigure: () => {},
  };

  handleConfigure = e => {
    this.props.onConfigure(this.props.provider.key, e);
  };

  renderDisabledLock = p => <LockedFeature provider={p.provider} features={p.features} />;

  renderInstallButton = (provider, hasFeature) => (
    <Button
      type="submit"
      name="provider"
      size="small"
      value={provider.key}
      disabled={!hasFeature}
      onClick={this.handleConfigure}
    >
      {t('Configure')}
    </Button>
  );

  render() {
    const {provider, organization} = this.props;

    return (
      <Feature
        features={[provider.requiredFeature].filter(f => f)}
        renderDisabled={({children, ...props}) =>
          children({...props, renderDisabled: this.renderDisabledLock})}
      >
        {({hasFeature, features, renderDisabled, renderInstallButton}) => (
          <PanelItem align="center">
            <Flex flex={1}>
              <ProviderLogo className={`provider-logo ${provider.name.toLowerCase()}`} />
              <Box px={2} flex={1}>
                <ProviderName>{provider.name}</ProviderName>
                <ProviderDescription>
                  {t('Enable your organization to sign in with %s.', provider.name)}
                </ProviderDescription>
              </Box>
            </Flex>

            <Box flex={1}>
              {!hasFeature && renderDisabled({organization, provider, features})}
            </Box>

            <Box>
              {(renderInstallButton || this.renderInstallButton)(provider, hasFeature)}
            </Box>
          </PanelItem>
        )}
      </Feature>
    );
  }
}

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

const DisabledHovercard = styled(Hovercard)`
  width: 350px;
`;

const LockedFeature = ({provider, features, className, ...props}) => (
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
    <Tag icon="icon-lock">disabled</Tag>
  </DisabledHovercard>
);

LockedFeature.propTypes = {
  provider: PropTypes.object.isRequired,
  features: PropTypes.arrayOf(PropTypes.string).isRequired,
};
