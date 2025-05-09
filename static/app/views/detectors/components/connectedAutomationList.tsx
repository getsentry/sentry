import {Button} from 'sentry/components/core/button';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useAutomationActions} from 'sentry/views/automations/hooks/utils';
import {AUTOMATIONS_BASE_URL} from 'sentry/views/automations/routes';

type Props = {
  automations: Automation[];
  connectedAutomationIds?: Set<string>;
  toggleConnected?: (id: string) => void;
};

export function ConnectedAutomationsList({
  automations,
  connectedAutomationIds,
  toggleConnected,
}: Props) {
  const canEdit = connectedAutomationIds && toggleConnected;

  const data = automations.map(automation => ({
    ...automation,
    connected: canEdit
      ? {
          isConnected: connectedAutomationIds?.has(automation.id),
          toggleConnected: () => toggleConnected?.(automation.id),
        }
      : undefined,
  }));

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

const baseColumns = defineColumns<Automation>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => (
      <AutomationTitleCell name={value} link={`${AUTOMATIONS_BASE_URL}/${row.id}/`} />
    ),
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

interface ConnectedAutomationsData extends Automation {
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

export interface ConnectedAutomationsListProps {
  automations: Automation[];
}
