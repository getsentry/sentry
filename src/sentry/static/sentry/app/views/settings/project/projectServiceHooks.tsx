import {Link, WithRouterProps} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Field from 'app/views/settings/components/forms/field';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Switch from 'app/components/switch';
import Truncate from 'app/components/truncate';
import {IconAdd, IconFlag} from 'app/icons';
import {ServiceHook} from 'app/types';

type RowProps = {
  orgId: string;
  projectId: string;
  hook: ServiceHook;
  onToggleActive: () => void;
};

function ServiceHookRow({orgId, projectId, hook, onToggleActive}: RowProps) {
  return (
    <Field
      label={
        <Link to={`/settings/${orgId}/projects/${projectId}/hooks/${hook.id}/`}>
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
      <Switch isActive={hook.status === 'active'} size="lg" toggle={onToggleActive} />
    </Field>
  );
}

type Props = WithRouterProps<{orgId: string; projectId: string}, {}>;

type State = {
  hookList: null | ServiceHook[];
} & AsyncView['state'];

export default class ProjectServiceHooks extends AsyncView<Props, State> {
  static contextTypes = {
    router: PropTypes.object,
    organization: PropTypes.object.isRequired,
  };

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [['hookList', `/projects/${orgId}/${projectId}/hooks/`]];
  }

  onToggleActive = (hook: ServiceHook) => {
    const {orgId, projectId} = this.props.params;
    const {hookList} = this.state;
    if (!hookList) {
      return;
    }

    addLoadingMessage(t('Saving changes\u2026'));

    this.api.request(`/projects/${orgId}/${projectId}/hooks/${hook.id}/`, {
      method: 'PUT',
      data: {
        isActive: hook.status !== 'active',
      },
      success: data => {
        clearIndicators();
        this.setState({
          hookList: hookList.map(h => {
            if (h.id === data.id) {
              return {
                ...h,
                ...data,
              };
            }
            return h;
          }),
        });
      },
      error: () => {
        addErrorMessage(t('Unable to remove application. Please try again.'));
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
    const {orgId, projectId} = this.props.params;

    return (
      <React.Fragment>
        <PanelHeader key="header">{t('Service Hook')}</PanelHeader>
        <PanelBody key="body">
          <PanelAlert type="info" icon={<IconFlag size="md" />}>
            {t(
              'Service Hooks are an early adopter preview feature and will change in the future.'
            )}
          </PanelAlert>
          {this.state.hookList?.map(hook => (
            <ServiceHookRow
              key={hook.id}
              orgId={orgId}
              projectId={projectId}
              hook={hook}
              onToggleActive={this.onToggleActive.bind(this, hook)}
            />
          ))}
        </PanelBody>
      </React.Fragment>
    );
  }

  renderBody() {
    const {hookList} = this.state;
    const body =
      hookList && hookList.length > 0 ? this.renderResults() : this.renderEmpty();

    const {orgId, projectId} = this.props.params;
    const access = new Set(this.context.organization.access);

    return (
      <div className="ref-project-service-hooks">
        <SettingsPageHeader
          title={t('Service Hooks')}
          action={
            access.has('project:write') ? (
              <Button
                data-test-id="new-service-hook"
                to={`/settings/${orgId}/projects/${projectId}/hooks/new/`}
                size="small"
                priority="primary"
                icon={<IconAdd size="xs" isCircled />}
              >
                {t('Create New Hook')}
              </Button>
            ) : null
          }
        />
        <Panel>{body}</Panel>
      </div>
    );
  }
}
