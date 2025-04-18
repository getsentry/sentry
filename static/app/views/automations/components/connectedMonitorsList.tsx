import {Button} from 'sentry/components/core/button';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {TypeCell} from 'sentry/components/workflowEngine/gridCell/typeCell';
import {UserCell} from 'sentry/components/workflowEngine/gridCell/userCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';

export interface MonitorsData {
  connect: {connected: boolean; toggleConnected: (connected: boolean) => void};
  createdBy: 'sentry' | AvatarUser;
  lastIssue: Group;
  name: {link: string; name: string; project: AvatarProject};
  type: 'errors' | 'metric' | 'uptime' | 'performance' | 'trace' | 'replay';
}

type Props = {
  monitors: MonitorsData[];
};

const columns = defineColumns<MonitorsData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value}) => (
      <TitleCell name={value.name} project={value.project} link={value.link} />
    ),
    width: '4fr',
  },
  type: {
    Header: () => t('Type'),
    Cell: ({value}) => <TypeCell type={value} />,
    width: '0.75fr',
  },
  lastIssue: {
    Header: () => t('Last Issue'),
    Cell: ({value}) => <IssueCell group={value} />,
    width: '2fr',
  },
  createdBy: {
    Header: () => t('Creator'),
    Cell: ({value}) => <UserCell user={value} />,
    width: '0.75fr',
  },
  connect: {
    Header: () => '',
    Cell: ({value}) => (
      <Button size="sm" onClick={() => value.toggleConnected(!value.connected)}>
        {value.connected ? t('Connected') : t('Connect')}
      </Button>
    ),
    width: '1.25fr',
  },
});

export default function ConnectedMonitorsList({monitors}: Props) {
  return <SimpleTable columns={columns} data={monitors} />;
}
