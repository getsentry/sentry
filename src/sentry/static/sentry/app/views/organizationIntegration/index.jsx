import {Box} from 'grid-emotion';
import {keyBy} from 'lodash';
import React from 'react';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingError from 'app/components/loadingError';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import marked from 'app/utils/marked';

import IntegrationDetails from './integrationDetails';
import InstalledIntegration from './installedIntegration';

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

export default class OrganizationIntegration extends AsyncView {
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
    const {orgId, providerKey} = this.props.params;

    return [
      ['config', `/organizations/${orgId}/config/integrations/`],
      [
        'integrations',
        `/organizations/${orgId}/integrations/?provider_key=${providerKey}`,
      ],
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
    const keyedItems = keyBy(this.state.integrations, i => i.id);
    const integrations = sortArray(
      Object.values({...keyedItems, [data.id]: data}),
      i => i.name
    );

    IndicatorStore.addSuccess(t('Integration Added'));
    this.setState({integrations});
  };

  handleDeleteIntegration = integration => {
    const {orgId} = this.props.params;
    const saveIndicator = IndicatorStore.add(t('Removing Integration'));

    const options = {
      method: 'DELETE',
      success: () => {
        this.setState({
          integrations: this.state.integrations.filter(
            item => item.id !== integration.id
          ),
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

    let props = link.startsWith('http') ? {href: link} : {to: link};

    return (
      <AlertLink {...props}>
        <span dangerouslySetInnerHTML={{__html: linkHtml}} />
      </AlertLink>
    );
  }

  renderBody() {
    const integrations = this.state.integrations;
    const provider = this.getProvider();

    if (provider === null) {
      return <LoadingError message={t('Invalid integration provider')} />;
    }

    const titleIcon = <PluginIcon size={28} pluginId={provider.key} />;

    const header = (
      <PanelHeader disablePadding hasButtons={provider.canAdd}>
        <Box px={2}>{provider.metadata.noun}</Box>
        {provider.canAdd && (
          <Box mr={1}>
            <Button size="xsmall" onClick={() => this.handleAddIntegration(provider)}>
              <span className="icon icon-add" /> {t('Add') + ' ' + provider.metadata.noun}
            </Button>
          </Box>
        )}
      </PanelHeader>
    );

    const integrationList =
      integrations.length === 0 ? (
        <EmptyMessage>{t('No %s integrations configured.', provider.name)}</EmptyMessage>
      ) : (
        integrations.map(integration => (
          <InstalledIntegration
            key={integration.id}
            provider={provider}
            integration={integration}
            onRemove={() => this.handleDeleteIntegration(integration)}
          />
        ))
      );

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
        <IntegrationDetails
          markdownDescription={provider.metadata.description}
          author={provider.metadata.author}
          links={[
            {href: provider.metadata.issue_url, title: t('Report an Issue')},
            {href: provider.metadata.source_url, title: t('View Source')},
          ]}
        />
      </React.Fragment>
    );
  }
}
