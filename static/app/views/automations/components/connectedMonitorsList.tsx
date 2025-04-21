import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {NumberCell} from 'sentry/components/workflowEngine/gridCell/numberCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';

interface MonitorsData {
  lastIssue: Group;
  name: {link: string; name: string; projectId: string};
  openIssues: number;
}

type Props = {
  monitors: MonitorsData[];
};

const columns = defineColumns<MonitorsData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value}) => (
      <TitleCell name={value.name} projectId={value.projectId} link={value.link} />
    ),
    width: '3fr',
  },
  lastIssue: {
    Header: () => t('Last Issue'),
    Cell: ({value}) => <IssueCell group={value} />,
    width: '2fr',
  },
  openIssues: {
    Header: () => t('Open Issues'),
    Cell: ({value}) => <NumberCell number={value} />,
    width: '1fr',
  },
});

export default function ConnectedMonitorsList({monitors}: Props) {
  return <SimpleTable columns={columns} data={monitors} />;
}
