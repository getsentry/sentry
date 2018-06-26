import {Box} from 'grid-emotion';
import {keyBy} from 'lodash';
import React from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';
import AlertLink from 'app/components/alertLink';
import AsyncView from 'app/views/asyncView';
import BreadcrumbTitle from 'app/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import InstalledIntegration from 'app/views/organizationIntegrations/installedIntegration';
import IntegrationDetails from 'app/views/organizationIntegrations/integrationDetails';
import LoadingError from 'app/components/loadingError';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import marked from 'app/utils/marked';

const alertLinkMarkedRenderer = new marked.Renderer();
alertLinkMarkedRenderer.paragraph = s => s;

export default class Integration extends AsyncView {
  getProvider() {
    const {config} = this.state;

    return config !== null
      ? config.providers.find(p => p.key == this.props.params.providerKey) || null
      : null;
  }

  getTitle() {
    const provider = this.getProvider();

    return provider === null ? 'Integration' : `${provider.name} Integration`;
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

  mergeIntegration = integration => {
    // Merge the new integration into the list. If we're updating an
    // integration overwrite the old integration.
    const keyedItems = keyBy(this.state.integrations, i => i.id);
    const integrations = sortArray(
      Object.values({...keyedItems, [integration.id]: integration}),
      i => i.name
    );
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

  handleDisableIntegration = integration => {
    let url;
    if (integration.accountType === 'User') {
      url = 'https://github.com/settings/installations';
    } else {
      let orgName = integration.domainName.split('/')[1];
      url = `https://github.com/organizations/${orgName}/settings/installations`;
    }
    window.open(url, '_blank');
  };

  renderAlertLink(provider) {
    const config = provider.metadata.aspects.alert_link;

    if (config === undefined) {
      return undefined;
    }

    const linkHtml = marked(config.text, {renderer: alertLinkMarkedRenderer});
    let link = config.link;

    for (const key in this.props.params) {
      link = link.replace(`:${key}`, this.props.params[key]);
    }

    let props = {};
    if (link.startsWith('http')) {
      props.href = link;
    } else {
      props.onClick = () => navigateTo(link, this.props.router);
    }

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

    const {orgId} = this.props.params;
    const titleIcon = <PluginIcon size={28} pluginId={provider.key} />;

    const integrationList =
      integrations.length === 0 ? (
        <EmptyMessage>{t('No %s integrations configured.', provider.name)}</EmptyMessage>
      ) : (
        integrations.map(integration => (
          <InstalledIntegration
            key={integration.id}
            orgId={orgId}
            provider={provider}
            integration={integration}
            onToggleEnabled={e => this.handleToggleProjectIntegration(integration, e)}
            onRemove={() => this.handleDeleteIntegration(integration)}
            onDisable={() => this.handleDisableIntegration(integration)}
          />
        ))
      );

    return (
      <React.Fragment>
        <BreadcrumbTitle routes={this.props.routes} title={provider.name} />
        <SettingsPageHeader title={provider.name} icon={titleIcon} />

        <Panel>
          <PanelHeader disablePadding hasButtons>
            <Box px={2}>{provider.metadata.noun}</Box>
            <Box mr={1}>
              <AddIntegrationButton
                size="xsmall"
                provider={provider}
                onAddIntegration={this.mergeIntegration}
              />
            </Box>
          </PanelHeader>
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
