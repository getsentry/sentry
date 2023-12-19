import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import usePageFilters from 'sentry/utils/usePageFilters';

import {Monitor, MonitorEnvironment} from '../types';

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
  orgSlug: string;
};

function MonitorIssuesEmptyMessage() {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning>
          <p>{t('No issues relating to this cron monitor have been found.')}</p>
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

function MonitorIssues({orgSlug, monitor, monitorEnvs}: Props) {
  const {dismiss, isDismissed} = useDismissAlert({
    key: `${orgSlug}:thresholds-setting-alert-dismissed`,
  });
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;
  const timeProps =
    start && end
      ? {
          start: getUtcDateString(start),
          end: getUtcDateString(end),
        }
      : {
          statsPeriod: period,
        };

  // TODO(epurkhiser): We probably want to filter on envrionemnt
  return (
    <Fragment>
      {!isDismissed && (
        <Alert
          type="warning"
          showIcon
          trailingItems={
            <ButtonBar gap={1}>
              <LinkButton
                size="xs"
                to={{
                  pathname: `/organizations/${orgSlug}/crons/${monitor.slug}/edit/`,
                  query: {
                    environment: selection.environments,
                    project: selection.projects,
                  },
                }}
              >
                {t('Monitor Settings')}
              </LinkButton>
              <Button
                aria-label={t('Dismiss')}
                size="xs"
                borderless
                icon={<IconClose />}
                onClick={dismiss}
              />
            </ButtonBar>
          }
        >
          {t('Too many issues? Configure thresholds in your monitor settings')}
        </Alert>
      )}
      <GroupList
        orgSlug={orgSlug}
        endpointPath={`/organizations/${orgSlug}/issues/`}
        queryParams={{
          query: `monitor.slug:"${monitor.slug}" environment:[${monitorEnvs
            .map(e => e.name)
            .join(',')}]`,
          project: monitor.project.id,
          limit: 20,
          ...timeProps,
        }}
        query=""
        renderEmptyMessage={MonitorIssuesEmptyMessage}
        canSelectGroups={false}
        withPagination={false}
        withChart={false}
        useTintRow={false}
        source="monitors"
      />
    </Fragment>
  );
}

export default MonitorIssues;
