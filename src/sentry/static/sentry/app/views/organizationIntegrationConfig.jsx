import {keyBy} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {Flex, Box} from '../components/grid';
import {sortArray} from '../utils';
import {t} from '../locale';
import AlertLink from '../components/alertLink';
import AsyncView from './asyncView';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import EmptyMessage from './settings/components/emptyMessage';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import {Panel, PanelBody, PanelHeader, PanelItem} from '../components/panels';
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
  font-size: 1.6rem;
  margin-bottom: 3px;
`;

const DomainName = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 1.4rem;
`;

const Details = styled(Flex)`
  font-size: 1.5rem;
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

  getProvider() {
    const {config} = this.state;

    if (config !== null) {
      return config.providers.find(p => p.key == this.props.params.providerKey) || null;
    }

    return null;
  }

  getTitle() {
    const provider = this.getProvider();

    if (provider === null) {
      return 'Global Integrations';
    }

    return `${provider.name} Integration`;
  }

  getEndpoints() {
    const {orgId} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      ['itemList', `/organizations/${orgId}/integrations/`],
    ];
  }

  handleAddIntegration = provider => {
    const name = 'sentryAddIntegration';

    const {url, width, height} = provider.setupDialog;
    const {left, top} = computeCenteredWindow(width, height);

    this.dialog = window.open(
      url,
      name,
      `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`
    );

    this.dialog.focus();
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
      IndicatorStore.addError(t('Unable to add Integration'));
      return;
    }

    // Merge the new integration into the list. If we're updating an
    // integration ovewrrite the old integration.
    const keyedItems = keyBy(this.state.itemList, i => i.id);
    const itemList = sortArray(
      Object.values({...keyedItems, [data.id]: data}),
      i => i.name
    );

    IndicatorStore.addSuccess(t('Integration Added'));
    this.setState({itemList});
  };

  handleDeleteIntegration = integration => {
    const {orgId} = this.props.params;
    const saveIndicator = IndicatorStore.add(t('Removing Integration'));

    const options = {
      method: 'DELETE',
      success: () => {
        this.setState({
          itemList: this.state.itemList.filter(item => item.id !== integration.id),
        });
        IndicatorStore.addSuccess(t('Integration removed'));
      },
      error: () => IndicatorStore.addError(t('Failed to remove Integration')),
      complete: () => IndicatorStore.remove(saveIndicator),
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
    const provider = this.getProvider();

    if (provider === null) {
      return <LoadingError message={t('Invalid integration provider')} />;
    }

    const titleIcon = <PluginIcon size={28} pluginId={provider.key} />;

    // TODO(epurkhiser): Workspaces needs to get genericised into the integration
    const header = (
      <PanelHeader disablePadding hasButtons>
        <Box px={2}>{t('Workspaces')}</Box>
        <Box mr={1}>
          <Button size="xsmall" onClick={() => this.handleAddIntegration(provider)}>
            <span className="icon icon-add" /> {t('Add Workspace')}
          </Button>
        </Box>
      </PanelHeader>
    );

    let integrationList = integrations.map(integration => {
      return (
        <PanelItem p={0} py={2} key={integration.id}>
          <Box pl={2}>
            <IntegrationIcon src={integration.icon} />
          </Box>
          <Box px={2} flex="1">
            <IntegrationName>{integration.name}</IntegrationName>
            <DomainName>{integration.domain_name}</DomainName>
          </Box>
          <Box mr={1} pr={2}>
            <Confirm
              message={t(
                'Removing this inegration will disable the integration for all projects. Are you sure you want to remove this integration?'
              )}
              onConfirm={() => this.handleDeleteIntegration(integration)}
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
              {t('Report an Issue')}
            </MetadataLink>
            <MetadataLink href={provider.metadata.source_url}>
              {t('View Source')}
            </MetadataLink>
          </Box>
        </Details>
      </React.Fragment>
    );
  }
}
