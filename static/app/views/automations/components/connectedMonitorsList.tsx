import {Button} from 'sentry/components/core/button';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {TypeCell} from 'sentry/components/workflowEngine/gridCell/typeCell';
import {UserCell} from 'sentry/components/workflowEngine/gridCell/userCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

type Props = {
  monitors: Detector[];
  connectedMonitorIds?: Set<string>;
  toggleConnected?: (id: string) => void;
};

export default function ConnectedMonitorsList({
  monitors,
  connectedMonitorIds,
  toggleConnected,
}: Props) {
  const canEdit = connectedMonitorIds && toggleConnected;

  const data = monitors.map(monitor => {
    return {
      title: {
        name: monitor.name,
        projectId: monitor.projectId,
        link: `/issues/monitors/${monitor.id}/`,
      },
      type: monitor.type,
      lastIssue: undefined, // TODO: call API to get last issue
      createdBy: monitor.createdBy,
      connected: canEdit
        ? {
            isConnected: connectedMonitorIds?.has(monitor.id),
            toggleConnected: () => toggleConnected?.(monitor.id),
          }
        : undefined,
    };
  });

  if (canEdit) {
    return <SimpleTable columns={connectedColumns} data={data} />;
  }

  return <SimpleTable columns={baseColumns} data={data} />;
}

interface BaseMonitorsData {
  createdBy: string;
  lastIssue: Group | undefined;
  title: {link: string; name: string; projectId: string};
  type: DetectorType;
}

const baseColumns = defineColumns<BaseMonitorsData>({
  title: {
    Header: () => t('Name'),
    Cell: ({value}) => (
      <TitleCell name={value.name} projectId={value.projectId} link={value.link} />
    ),
    width: '4fr',
  },
  type: {
    Header: () => t('Type'),
    Cell: ({value}) => <TypeCell type={value} />,
    width: '1fr',
  },
  lastIssue: {
    Header: () => t('Last Issue'),
    Cell: ({value}) => <IssueCell group={value} />,
    width: '1.5fr',
  },
  createdBy: {
    Header: () => t('Creator'),
    Cell: ({value}) => <UserCell user={value} />,
    width: '1fr',
  },
});

interface ConnectedMonitorsData extends BaseMonitorsData {
  connected?: {
    isConnected: boolean;
    toggleConnected: () => void;
  };
}

const connectedColumns = defineColumns<ConnectedMonitorsData>({
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
