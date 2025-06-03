import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useDetectorQueriesByIds} from 'sentry/views/automations/hooks';
import {useAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

type Props = {
  automationIds: Detector['workflowIds'];
  connectedAutomationIds?: Set<string>;
  toggleConnected?: (id: string) => void;
};

export function ConnectedAutomationsList({
  automationIds,
  connectedAutomationIds,
  toggleConnected,
}: Props) {
  const organization = useOrganization();
  const canEdit = connectedAutomationIds && !!toggleConnected;
  const queries = useDetectorQueriesByIds(automationIds);

  const data = queries
    .map((query): ConnectedAutomationsData | undefined => {
      if (!query.data) {
        return undefined;
      }
      return {
        ...query.data,
        link: makeAutomationDetailsPathname(organization.slug, query.data.id),
        connected: canEdit
          ? {
              isConnected: connectedAutomationIds?.has(query.data.id),
              toggleConnected: () => toggleConnected?.(query.data.id),
            }
          : undefined,
      };
    })
    .filter((x): x is ConnectedAutomationsData => x !== undefined);

  const isLoading = queries.some(query => query.isPending);
  const isError = queries.some(query => query.isError);

  if (isError) {
    return <LoadingError />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (canEdit) {
    return <SimpleTable columns={connectedColumns} data={data} />;
  }

  return (
    <SimpleTable
      columns={baseColumns}
      data={data}
      fallback={t('No automations connected')}
    />
  );
}

interface BaseAutomationData extends Automation {
  link: string;
}

const baseColumns = defineColumns<BaseAutomationData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => <AutomationTitleCell name={value} href={row.link} />,
    width: 'minmax(0, 3fr)',
  },
  lastTriggered: {
    Header: () => t('Last Triggered'),
    Cell: ({value}) => <TimeAgoCell date={value} />,
  },
  actionFilters: {
    Header: () => t('Actions'),
    Cell: ({row}) => {
      const actions = useAutomationActions(row);
      return <ActionCell actions={actions} />;
    },
  },
});

interface ConnectedAutomationsData extends BaseAutomationData {
  connected?: {
    isConnected: boolean;
    toggleConnected: () => void;
  };
}

const connectedColumns = defineColumns<ConnectedAutomationsData>({
  ...baseColumns,
  connected: {
    Header: () => null,
    Cell: ({value}) =>
      value && (
        <Button onClick={value.toggleConnected}>
          {value.isConnected ? t('Disconnect') : t('Connect')}
        </Button>
      ),
    width: '1fr',
  },
});
