import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {useAutomationActions} from 'sentry/views/automations/hooks/utils';

interface ConnectedAutomationData extends Automation {
  link: string;
}

const columns = defineColumns<ConnectedAutomationData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => (
      <TitleCell name={value} link={row.link} projectId={row.detectorIds[0]} />
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

interface ConnectedAutomationsListProps {
  automations: ConnectedAutomationData[];
}
export function ConnectedAutomationsList({automations}: ConnectedAutomationsListProps) {
  return (
    <SimpleTable
      data={automations}
      columns={columns}
      fallback={t('No automations connected')}
    />
  );
}
