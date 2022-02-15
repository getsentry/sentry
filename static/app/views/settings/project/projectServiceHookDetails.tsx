import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Field from 'sentry/components/forms/field';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ServiceHook} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ServiceHookSettingsForm from 'sentry/views/settings/project/serviceHookSettingsForm';

type Params = {hookId: string; orgId: string; projectId: string};

type StatsProps = {
  params: Params;
};

type StatsState = {
  stats: {total: number; ts: number}[] | null;
} & AsyncComponent['state'];

class HookStats extends AsyncComponent<StatsProps, StatsState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    if (stats === null) {
      return null;
    }
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
              showTimeInTooltip
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

type Props = RouteComponentProps<Params, {}>;
type State = {
  hook: ServiceHook | null;
} & AsyncView['state'];

export default class ProjectServiceHookDetails extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    if (!hook) {
      return null;
    }

    return (
      <Fragment>
        <SettingsPageHeader title={t('Service Hook Details')} />

        <ErrorBoundary>
          <HookStats params={this.props.params} />
        </ErrorBoundary>

        <ServiceHookSettingsForm
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
                  {t('Delete Hook')}
                </Button>
              </div>
            </Field>
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}
