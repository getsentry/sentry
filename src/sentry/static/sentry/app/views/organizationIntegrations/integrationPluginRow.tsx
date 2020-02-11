import React from 'react';
import styled from '@emotion/styled';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {PluginWithProjectList, Organization} from 'app/types';
import IntegrationStatus from './integrationStatus';

type Props = {
  plugin: PluginWithProjectList;
  isLegacy: boolean;
  organization: Organization;
};

export default class PluginRow extends React.Component<Props> {
  get isEnabled() {
    // It's possible to only have items in projectList that are disabled configs (enabled=false).
    // But for the purpose of showing things that are installed, that might be OK.
    return this.props.plugin.projectList.length > 0;
  }

  get status() {
    return this.isEnabled ? 'Installed' : 'Not Installed';
  }

  render() {
    const {
      plugin,
      isLegacy,
      organization: {slug},
    } = this.props;

    return (
      <PanelItem p={0} flexDirection="column" data-test-id={plugin.id}>
        <FlexContainer>
          <PluginIcon size={36} pluginId={plugin.id} />
          <Container>
            <ProviderName to={`/settings/${slug}/plugins/${plugin.slug}/`}>
              {`${plugin.name} ${isLegacy ? '(Legacy)' : ''}`}
            </ProviderName>
            <ProviderDetails>
              <IntegrationStatus status={this.status} />
              {plugin.projectList.length ? (
                <StyledLink
                  to={`/settings/${slug}/plugins/${plugin.slug}/?tab=configurations`}
                >{`${plugin.projectList.length} Configuration${
                  plugin.projectList.length > 1 ? 's' : ''
                }`}</StyledLink>
              ) : null}
            </ProviderDetails>
          </Container>
        </FlexContainer>
      </PanelItem>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const FlexContainer = styled(Flex)`
  align-items: center;
  padding: ${space(2)};
`;

const Container = styled('div')`
  flex: 1;
  padding: 0 ${space(2)};
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

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;
