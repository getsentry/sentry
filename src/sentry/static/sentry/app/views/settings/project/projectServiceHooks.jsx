import PropTypes from 'prop-types';
import {Link} from 'react-router';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Field from 'app/views/settings/components/forms/field';
import IndicatorStore from 'app/stores/indicatorStore';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Switch from 'app/components/switch';
import Truncate from 'app/components/truncate';

const ServiceHookRow = createReactClass({
  displayName: 'ServiceHookRow',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    hook: PropTypes.object.isRequired,
    onToggleActive: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  render() {
    let {orgId, projectId, hook} = this.props;
    return (
      <Field
        label={
          <Link to={`/settings/${orgId}/${projectId}/hooks/${hook.id}/`}>
            <Truncate value={hook.url} />
          </Link>
        }
        help={
          hook.events && hook.events.length !== 0 ? (
            <small>{hook.events.join(', ')}</small>
          ) : (
            <small>
              <em>no events configured</em>
            </small>
          )
        }
      >
        <Switch
          isActive={hook.status === 'active'}
          size="lg"
          toggle={this.props.onToggleActive}
        />
      </Field>
    );
  },
});

export default class ProjectServiceHooks extends AsyncView {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [['hookList', `/projects/${orgId}/${projectId}/hooks/`]];
  }

  onToggleActive = hook => {
    let {orgId, projectId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/hooks/${hook.id}/`, {
      method: 'PUT',
      data: {
        isActive: hook.status !== 'active',
      },
      success: data => {
        IndicatorStore.remove(loadingIndicator);
        let hookList = this.state.hookList.map(h => {
          if (h.id === data.id) {
            return {
              ...h,
              ...data,
            };
          }
          return h;
        });
        this.setState({hookList});
      },
      error: () => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(
          t('Unable to remove application. Please try again.'),
          'error',
          {
            duration: 3000,
          }
        );
      },
    });
  };

  renderEmpty() {
    return (
      <EmptyMessage>
        {t('There are no service hooks associated with this project.')}
      </EmptyMessage>
    );
  }

  renderResults() {
    let {orgId, projectId} = this.props.params;

    return (
      <React.Fragment>
        <PanelHeader key={'header'}>{t('Service Hook')}</PanelHeader>
        <PanelBody key={'body'}>
          <PanelAlert type="info" icon="icon-circle-exclamation" m={0} mb={0}>
            Service Hooks are an early adopter preview feature and will change in the
            future.
          </PanelAlert>
          {this.state.hookList.map(hook => {
            return (
              <ServiceHookRow
                key={hook.id}
                orgId={orgId}
                projectId={projectId}
                hook={hook}
                onToggleActive={this.onToggleActive.bind(this, hook)}
              />
            );
          })}
        </PanelBody>
      </React.Fragment>
    );
  }

  renderBody() {
    let body;
    if (this.state.hookList.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

    let {orgId, projectId} = this.props.params;
    let access = new Set(this.context.organization.access);

    return (
      <div className="ref-project-service-hooks">
        <SettingsPageHeader
          title={t('Service Hooks')}
          action={
            access.has('project:write') ? (
              <Button
                data-test-id="new-service-hook"
                to={`/settings/${orgId}/${projectId}/hooks/new/`}
                size="small"
                priority="primary"
              >
                <span className="icon-plus" />&nbsp;{t('Create New Hook')}
              </Button>
            ) : null
          }
        />
        <Panel>{body}</Panel>
      </div>
    );
  }
}
