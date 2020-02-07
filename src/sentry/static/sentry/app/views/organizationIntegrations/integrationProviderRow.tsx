import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import CircleIndicator from 'app/components/circleIndicator';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {IntegrationProvider, Integration} from 'app/types';

type Props = {
  provider: IntegrationProvider;
  integrations: Integration[];
};

export default class ProviderRow extends React.Component<Props> {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    integrations: PropTypes.array.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  get isEnabled() {
    return this.props.integrations.length > 0;
  }

  render() {
    const {provider, integrations} = this.props;
    const {
      organization: {slug},
    } = this.context;
    return (
      <PanelItem p={0} flexDirection="column" data-test-id={provider.key}>
        <Flex style={{alignItems: 'center', padding: '16px'}}>
          <PluginIcon size={36} pluginId={provider.key} />
          <div style={{flex: '1', padding: '0 16px'}}>
            <ProviderName to={`/settings/${slug}/integrations/${provider.key}/`}>
              {provider.name}
            </ProviderName>
            <ProviderDetails>
              <Status enabled={this.isEnabled} />
              {integrations.length ? (
                <StyledLink
                  to={`/settings/${slug}/integrations/${provider.key}/?tab=configurations`}
                >{`${integrations.length} Configuration${
                  integrations.length > 1 ? 's' : ''
                }`}</StyledLink>
              ) : null}
            </ProviderDetails>
          </div>
        </Flex>
      </PanelItem>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const ProviderName = styled(Link)`
  font-weight: bold;
  color: ${props => props.theme.textColor};
`;

const ProviderDetails = styled(Flex)`
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

type StatusProps = {
  enabled: boolean;
  theme?: any; //TS complains if we don't make this optional
};

const Status = styled(
  withTheme((props: StatusProps) => {
    const {enabled, theme, ...p} = props;
    return (
      <StatusWrapper>
        <CircleIndicator
          enabled={enabled}
          size={6}
          color={enabled ? theme.success : theme.gray2}
        />
        <div {...p}>{enabled ? t('Installed') : t('Not Installed')}</div>
      </StatusWrapper>
    );
  })
)`
  color: ${(p: StatusProps) => (p.enabled ? p.theme.success : p.theme.gray2)};
  margin-left: ${space(0.5)};
  margin-right: ${space(0.75)};
`;

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;
