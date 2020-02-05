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
import {PluginWithProjectList} from 'app/types';

type Props = {
  plugin: PluginWithProjectList;
  legacy: boolean;
};

export default class PluginRow extends React.Component<Props> {
  static propTypes = {
    plugin: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  get isEnabled() {
    return this.props.plugin.projectList.length > 0;
  }

  render() {
    const {plugin, legacy} = this.props;
    const {
      organization: {slug},
    } = this.context;
    return (
      <PanelItem p={0} flexDirection="column" data-test-id={plugin.id}>
        <Flex style={{alignItems: 'center', padding: '16px'}}>
          <PluginIcon size={36} pluginId={plugin.id} />
          <div style={{flex: '1', padding: '0 16px'}}>
            <ProviderName to={`/settings/${slug}/integrations/${plugin.id}`}>
              {`${plugin.name} ${legacy ? '(Legacy)' : ''}`}
            </ProviderName>
            <ProviderDetails>
              <Status enabled={this.isEnabled} />
              <StyledLink
                to={`/settings/${slug}/integrations/${plugin.id}?tab=configurations`}
              >{`${plugin.projectList.length} Configurations`}</StyledLink>
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
  &:after {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-left: ${space(0.75)};
    font-weight: normal;
  }
`;

const StatusWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
`;
