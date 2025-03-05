import {deleteMonitor, updateMonitor} from 'sentry/actionCreators/monitors';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import Link from 'sentry/components/links/link';
import {IconDelete, IconEdit, IconSubscribed, IconUnsubscribed} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

import type {Monitor} from '../types';

import {StatusToggleButton} from './statusToggleButton';

type Props = {
  monitor: Monitor;
  onUpdate: (data: Monitor) => void;
  orgSlug: string;
  /**
   * TODO(epurkhiser): Remove once crons exists only in alerts
   */
  linkToAlerts?: boolean;
};

function MonitorHeaderActions({monitor, orgSlug, onUpdate, linkToAlerts}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
    },
  };

  const handleDelete = async () => {
    await deleteMonitor(api, orgSlug, monitor);
    browserHistory.push(
      normalizeUrl({
        pathname: linkToAlerts
          ? `/organizations/${orgSlug}/insights/backend/crons/`
          : `/organizations/${orgSlug}/crons/`,
        query: endpointOptions.query,
      })
    );
  };

  const handleUpdate = async (data: Partial<Monitor>) => {
    const resp = await updateMonitor(api, orgSlug, monitor, data);

    if (resp !== null) {
      onUpdate?.(resp);
    }
  };

  const canEdit = hasEveryAccess(['alerts:write'], {
    organization,
    project: monitor.project,
  });
  const permissionTooltipText = tct(
    'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}`} />}
  );

  const disableProps = {
    disabled: !canEdit,
    title: !canEdit ? permissionTooltipText : undefined,
  };

  return (
    <ButtonBar gap={1}>
      <FeedbackWidgetButton />
      <Button
        size="sm"
        icon={monitor.isMuted ? <IconSubscribed /> : <IconUnsubscribed />}
        onClick={() => handleUpdate({isMuted: !monitor.isMuted})}
        {...disableProps}
      >
        {monitor.isMuted ? t('Unmute') : t('Mute')}
      </Button>
      <StatusToggleButton
        size="sm"
        monitor={monitor}
        onToggleStatus={status => handleUpdate({status})}
        {...disableProps}
      />
      <Confirm
        onConfirm={handleDelete}
        message={t('Are you sure you want to permanently delete this cron monitor?')}
      >
        <Button
          size="sm"
          icon={<IconDelete size="xs" />}
          aria-label={t('Delete')}
          {...disableProps}
        />
      </Confirm>
      <LinkButton
        size="sm"
        icon={<IconEdit />}
        to={{
          pathname: linkToAlerts
            ? makeAlertsPathname({
                path: `/crons-rules/${monitor.project.slug}/${monitor.slug}/`,
                organization,
              })
            : `/organizations/${orgSlug}/crons/${monitor.project.slug}/${monitor.slug}/edit/`,
          // TODO(davidenwang): Right now we have to pass the environment
          // through the URL so that when we save the monitor and are
          // redirected back to the details page it queries the backend
          // for a monitor environment with check-in data
          query: {
            environment: selection.environments,
            project: selection.projects,
          },
        }}
        {...disableProps}
      >
        {t('Edit Monitor')}
      </LinkButton>
    </ButtonBar>
  );
}

export default MonitorHeaderActions;
