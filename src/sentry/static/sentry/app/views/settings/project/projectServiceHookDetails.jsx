import {browserHistory} from 'react-router';
import React from 'react';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ErrorBoundary from 'app/components/errorBoundary';
import Field from 'app/views/settings/components/forms/field';
import {IconFlag} from 'app/icons';
import ServiceHookSettingsForm from 'app/views/settings/project/serviceHookSettingsForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import MiniBarChart from 'app/components/charts/miniBarChart';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import getDynamicText from 'app/utils/getDynamicText';

class HookStats extends AsyncComponent {
  getEndpoints() {
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;
    const {hookId, orgId, projectId} = this.props.params;
    return [
      [
        'stats',
        `/projects/${orgId}/${projectId}/hooks/${hookId}/stats/`,
        {
          query: {
            since,
            until,
            resolution: '1d',
          },
        },
      ],
    ];
  }

  renderBody() {
    const {stats} = this.state;
    let emptyStats = true;

    const series = {
      seriesName: t('Events'),
      data: stats.map(p => {
        if (p.total) {
          emptyStats = false;
        }
        return {
          name: p.ts * 1000,
          value: p.total,
        };
      }),
    };

    return (
      <Panel>
        <PanelHeader>{t('Events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody withPadding>
          {!emptyStats ? (
            <MiniBarChart
              isGroupedByDate
              showTimeinTooltip
              labelYAxisExtents
              series={[series]}
              height={150}
            />
          ) : (
            <EmptyMessage
              title={t('Nothing recorded in the last 30 days.')}
              description={t('Total webhooks fired for this configuration.')}
            />
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default class ProjectServiceHookDetails extends AsyncView {
  getEndpoints() {
    const {orgId, projectId, hookId} = this.props.params;
    return [['hook', `/projects/${orgId}/${projectId}/hooks/${hookId}/`]];
  }

  onDelete = () => {
    const {orgId, projectId, hookId} = this.props.params;
    addLoadingMessage(t('Saving changes\u2026'));
    this.api.request(`/projects/${orgId}/${projectId}/hooks/${hookId}/`, {
      method: 'DELETE',
      success: () => {
        clearIndicators();
        browserHistory.push(`/settings/${orgId}/projects/${projectId}/hooks/`);
      },
      error: () => {
        addErrorMessage(t('Unable to remove application. Please try again.'));
      },
    });
  };

  renderBody() {
    const {orgId, projectId, hookId} = this.props.params;
    const {hook} = this.state;
    return (
      <div>
        <SettingsPageHeader title={t('Service Hook Details')} />

        <ErrorBoundary>
          <HookStats params={this.props.params} />
        </ErrorBoundary>

        <ServiceHookSettingsForm
          {...this.props}
          orgId={orgId}
          projectId={projectId}
          hookId={hookId}
          initialData={{
            ...hook,
            isActive: hook.status !== 'disabled',
          }}
        />
        <Panel>
          <PanelHeader>{t('Event Validation')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info" icon={<IconFlag size="md" />}>
              Sentry will send the <code>X-ServiceHook-Signature</code> header built using{' '}
              <code>HMAC(SHA256, [secret], [payload])</code>. You should always verify
              this signature before trusting the information provided in the webhook.
            </PanelAlert>
            <Field
              label={t('Secret')}
              flexibleControlStateSize
              inline={false}
              help={t('The shared secret used for generating event HMAC signatures.')}
            >
              <TextCopyInput>
                {getDynamicText({
                  value: hook.secret,
                  fixed: 'a dynamic secret value',
                })}
              </TextCopyInput>
            </Field>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Delete Hook')}</PanelHeader>
          <PanelBody>
            <Field
              label={t('Delete Hook')}
              help={t('Removing this hook is immediate and permanent.')}
            >
              <div>
                <Button priority="danger" onClick={this.onDelete}>
                  Delete Hook
                </Button>
              </div>
            </Field>
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
