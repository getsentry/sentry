import {Flex, Box} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';

import {sortArray} from '../utils';
import {t} from '../locale';
import AlertLink from '../components/alertLink';
import AsyncView from './asyncView';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import EmptyMessage from './settings/components/emptyMessage';
import IndicatorStore from '../stores/indicatorStore';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import PanelItem from './settings/components/panelItem';
import PluginIcon from '../plugins/components/pluginIcon';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import marked from '../utils/marked';

const IntegrationIcon = styled.img`
  height: 32px;
  width: 32px;
  border-radius: 3px;
  display: block;
`;

const IntegrationName = styled.div`
  font-size: 16px;
  margin-bottom: 3px;
`;

const DomainName = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 14px;
`;

const Details = styled(Flex)`
  font-size: 15px;
  line-height: 2.1rem;
`;

const Description = styled.div`
  li {
    margin-bottom: 6px;
  }
`;

const AuthorName = styled.div`
  color: ${p => p.theme.gray2};
`;

const MetadataLink = styled.a`
  display: block;
  margin-bottom: 6px;
`;

const alertLinkMarkedRenderer = new marked.Renderer();
alertLinkMarkedRenderer.paragraph = s => s;

function computeCenteredWindow(width, height) {
  const screenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
  const screenTop = window.screenTop != undefined ? window.screenTop : screen.top;
  const innerWidth = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;

  const innerHeight = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

  const left = innerWidth / 2 - width / 2 + screenLeft;
  const top = innerHeight / 2 - height / 2 + screenTop;

  return {left, top};
}

export default class OrganizationIntegrationConfig extends AsyncView {
  // TODO: proptypes

  componentDidMount() {
    this.dialog = null;
    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    window.removeEventListener('message', this.receiveMessage);

    if (this.dialog !== null) {
      this.dialog.close();
    }
  }

  getTitle() {
    if (this.state.config === null) {
      return 'Global Integrations';
    }

    const {providerKey} = this.props.params;
    const provider = this.state.config.providers.find(p => p.key == providerKey);

    return `${provider.name} Integration`;
  }

  getEndpoints() {
    const {orgId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['itemList', `/organizations/${orgId}/integrations/`, {query: {status: ''}}],
    ];
  }

  launchAddIntegration = provider => {
    const name = 'sentryAddIntegration';

    const {url, width, height} = provider.setupDialog;
    const {left, top} = computeCenteredWindow(width, height);

    this.dialog = window.open(
      url,
      name,
      `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`
    );

    this.dialog.focus();
    this.dialog.onclose = () => document.location.refresh();
  };

  receiveMessage = message => {
    if (message.origin !== document.origin) {
      return;
    }

    if (message.source !== this.dialog) {
      return;
    }

    this.dialog = null;

    const {success, data} = message.data;

    if (!success) {
      // TODO: Error state here
      return;
    }

    let itemList = [...this.state.itemList, data];
    itemList = sortArray(itemList, i => i.name);
    itemList = _.uniqBy(itemList, i => i.id);

    this.setState({itemList});
  };

  deleteIntegration = integration => {
    const {orgId} = this.props.params;

    const options = {
      method: 'DELETE',
      success: () =>
        this.setState({
          itemList: this.state.itemList.filter(item => item.id !== integration.id),
        }),

      // TODO toast indoactor for errors / complete
    };

    this.api.request(`/organizations/${orgId}/integrations/${integration.id}/`, options);
  };

  renderAlertLink(provider) {
    const config = provider.metadata.aspects.alert_link;

    if (config === undefined) {
      return undefined;
    }

    const linkHtml = marked(config.text, {renderer: alertLinkMarkedRenderer});
    let link = config.link;

    for (const key in this.props.params) {
      link = link.replace(`{${key}}`, this.props.params[key]);
    }

    return (
      <AlertLink to={link}>
        <span dangerouslySetInnerHTML={{__html: linkHtml}} />
      </AlertLink>
    );
  }

  renderBody() {
    const {providerKey} = this.props.params;

    const integrations = this.state.itemList.filter(i => i.provider.key === providerKey);
    const provider = this.state.config.providers.find(p => p.key == providerKey);

    // TODO: some kind of 404ish thing here

    // TODO: Workspaces needs to get genericised into the integration

    const titleIcon = <PluginIcon size={28} pluginId={provider.key} />;

    const header = (
      <PanelHeader disablePadding hasButtons>
        <Flex align="center">
          <Box px={2} flex="1">
            {t('Workspaces')}
          </Box>
          <Box mr={1}>
            <Button size="xsmall" onClick={() => this.launchAddIntegration(provider)}>
              <span className="icon icon-add" /> {t('Add Workspace')}
            </Button>
          </Box>
        </Flex>
      </PanelHeader>
    );

    let integrationList = integrations.map(integration => {
      return (
        <PanelItem p={0} py={2} key={integration.id}>
          <Box pl={2}>
            <IntegrationIcon src={integration.icon} />
          </Box>
          <Box px={2} flex={1}>
            <IntegrationName>{integration.name}</IntegrationName>
            <DomainName>{integration.domain_name}</DomainName>
          </Box>
          <Box mr={1} pr={2}>
            <Confirm
              message={t(
                'Removing this inegration will disable the integration for all projects. Are you sure you want to remove this integration?'
              )}
              onConfirm={() => this.deleteIntegration(integration)}
            >
              <Button size="small">
                <span className="icon icon-trash" style={{margin: 0}} />
              </Button>
            </Confirm>
          </Box>
        </PanelItem>
      );
    });

    if (integrationList.length === 0) {
      integrationList = (
        <EmptyMessage>{t('No %s integrations configured.', provider.name)}</EmptyMessage>
      );
    }

    return (
      <React.Fragment>
        <SettingsPageHeader title={provider.name} icon={titleIcon} />

        <Panel>
          {header}
          <PanelBody>{integrationList}</PanelBody>
        </Panel>

        {this.renderAlertLink(provider)}

        <hr />

        <h5>{t('%s Integration', provider.name)}</h5>
        <Details>
          <Box width={5 / 8}>
            <Description
              dangerouslySetInnerHTML={{__html: marked(provider.metadata.description)}}
            />
            <AuthorName>{t('By %s', provider.metadata.author)}</AuthorName>
          </Box>
          <Box ml={60}>
            <MetadataLink href={provider.metadata.issue_url}>
              Report an Issue
            </MetadataLink>
            <MetadataLink href={provider.metadata.source_url}>View Source</MetadataLink>
          </Box>
        </Details>
      </React.Fragment>
    );
  }
}
