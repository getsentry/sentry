import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/views/automations/components/automationListRow';

const columns = defineColumns<Automation>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => (
      <TitleCell name={value} link={row.link} project={row.project} />
    ),
    width: 'minmax(0, 3fr)',
  },
  lastTriggered: {
    Header: () => t('Last Triggered'),
    Cell: ({value}) => <TimeAgoCell date={value} />,
  },
  actions: {
    Header: () => t('Actions'),
    Cell: ({value}) => <ActionCell actions={value} />,
  },
});

export interface ConnectedAutomationsListProps {
  automations: Automation[];
}
export function ConnectedAutomationsList({automations = []}) {
  return (
    <SimpleTable
      data={automations}
      columns={columns}
      fallback={t('No automations connected')}
    />
  );
}
