import React from 'react';

import {sortArray} from '../utils';
import {t} from '../locale';
import AsyncView from './asyncView';
import Confirm from '../components/confirm';
import DropdownLink from '../components/dropdownLink';
import IndicatorStore from '../stores/indicatorStore';
import MenuItem from '../components/menuItem';

export default class OrganizationIntegrations extends AsyncView {
  componentDidMount() {
    // super.componentDidMount();
    // this.dialogCallbackName = `sIntConf_${Math.floor(Math.random() * 10000)}`;
    this.dialog = null;
    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.dialog && this.dialog.close();
    window.removeEventListener('message', this.receiveMessage);
  }

  receiveMessage = event => {
    if (event.origin !== document.origin) {
      return;
    }
    if (event.source !== this.dialog) {
      return;
    }

    let {success, data} = event.data;
    if (success) {
      let itemList = this.state.itemList;
      itemList.push(data);
      this.setState({
        itemList: sortArray(itemList, item => item.name),
      });
    } else {
      IndicatorStore.add(data.detail, 'error', {
        duration: 5000,
      });
    }
    this.dialog = null;
  };

  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      ['itemList', `/organizations/${orgId}/integrations/`, {query: {status: ''}}],
      ['config', `/organizations/${orgId}/config/integrations/`],
    ];
  }

  deleteIntegration = integration => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(
      `/organizations/${this.props.params.orgId}/integrations/${integration.id}/`,
      {
        method: 'DELETE',
        success: () => {
          this.setState({
            itemList: this.state.itemList.filter(item => item.id !== integration.id),
          });
        },
        error: () => {
          IndicatorStore.add(t('An error occurred.'), 'error', {
            duration: 3000,
          });
        },
        complete: () => {
          IndicatorStore.remove(indicator);
        },
      }
    );
  };

  launchAddIntegration = integration => {
    let name = 'sentryAddIntegration';
    let {url, width, height} = integration.setupDialog;
    // this attempts to center the dialog
    let screenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
    let screenTop = window.screenTop != undefined ? window.screenTop : screen.top;
    let innerWidth = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth
        ? document.documentElement.clientWidth
        : screen.width;
    let innerHeight = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight
        ? document.documentElement.clientHeight
        : screen.height;
    let left = innerWidth / 2 - width / 2 + screenLeft;
    let top = innerHeight / 2 - height / 2 + screenTop;

    this.dialog = window.open(
      url,
      name,
      `scrollbars=yes, width=${width}, height=${height}, top=${top}, left=${left}`
    );
    window.focus && this.dialog.focus();
    this.dialog.onclose = () => {
      this.dialog && document.location.refresh();
    };
  };

  getStatusLabel(integration) {
    switch (integration.status) {
      case 'pending_deletion':
        return 'Deletion Queued';
      case 'deletion_in_progress':
        return 'Deletion in Progress';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  getTitle() {
    return 'Integrations';
  }

  renderBody() {
    let itemList = this.state.itemList;
    let iconStyles = {
      width: 24,
      height: 24,
      display: 'inline-block',
    };

    return (
      <div className="ref-organization-integrations">
        <div className="pull-right">
          <DropdownLink
            anchorRight
            className="btn btn-primary btn-sm"
            title={t('Add Integration')}
          >
            {this.state.config.providers.map(provider => {
              return (
                <MenuItem noAnchor={true} key={provider.key}>
                  <a onClick={() => this.launchAddIntegration(provider)}>
                    {provider.name}
                  </a>
                </MenuItem>
              );
            })}
          </DropdownLink>
        </div>
        <h3 className="m-b-2">{t('Integrations')}</h3>
        {itemList.length > 0 ? (
          <div className="panel panel-default">
            <table className="table">
              <tbody>
                {itemList.map(integration => {
                  return (
                    <tr key={integration.id}>
                      <td style={{width: 24, paddingRight: 0}}>
                        <span
                          className={`icon icon-integration icon-${integration.provider
                            .key}`}
                          style={iconStyles}
                        />
                      </td>
                      <td>
                        <strong>{integration.name}</strong> —{' '}
                        <small>{integration.provider.name}</small>
                      </td>
                      <td style={{width: 60}}>
                        <Confirm
                          message={t('Are you sure you want to remove this integration?')}
                          onConfirm={() => this.deleteIntegration(integration)}
                        >
                          <button className="btn btn-default btn-xs">
                            <span className="icon icon-trash" />
                          </button>
                        </Confirm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="well blankslate align-center p-x-2 p-y-1">
            <div className="icon icon-lg icon-git-commit" />
            <h3>{t('Sentry is better with friends')}</h3>
            <p>
              {t(
                'Integrations allow you to pull in things like repository data or sync with an external issue tracker.'
              )}
            </p>
            <p className="m-b-1">
              <a
                className="btn btn-default"
                href="https://docs.sentry.io/learn/integrations/"
              >
                Learn more
              </a>
            </p>
          </div>
        )}
      </div>
    );
  }
}
