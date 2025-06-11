import type {Dispatch, SetStateAction} from 'react';

import {Button} from 'sentry/components/core/button';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type Props = {
  monitors: Detector[];
  connectedIds?: Set<string>;
  setConnectedIds?: Dispatch<SetStateAction<Set<string>>>;
};

export default function ConnectedMonitorsList({
  monitors,
  connectedIds,
  setConnectedIds,
}: Props) {
  const organization = useOrganization();
  const canEdit = connectedIds && !!setConnectedIds;

  const toggleConnected = (id: string) => {
    setConnectedIds?.(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const data = monitors.map(monitor => ({
    title: {
      name: monitor.name,
      createdBy: monitor.createdBy,
      projectId: monitor.projectId,
      link: makeMonitorDetailsPathname(organization.slug, monitor.id),
    },
    type: monitor.type,
    lastIssue: undefined, // TODO: call API to get last issue
    owner: monitor.owner,
    connected: canEdit
      ? {
          isConnected: connectedIds?.has(monitor.id),
          toggleConnected: () => toggleConnected?.(monitor.id),
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
      fallback={t('No monitors connected')}
    />
  );
}

interface BaseMonitorsData {
  lastIssue: Group | undefined;
  owner: Detector['owner'];
  title: {createdBy: string | null; link: string; name: string; projectId: string};
  type: Detector['type'];
}

const baseColumns = defineColumns<BaseMonitorsData>({
  title: {
    Header: () => t('Name'),
    Cell: ({value}) => (
      <TitleCell
        name={value.name}
        createdBy={value.createdBy}
        projectId={value.projectId}
        link={value.link}
      />
    ),
    width: '4fr',
  },
  type: {
    Header: () => t('Type'),
    Cell: ({value}) => <DetectorTypeCell type={value} />,
    width: '1fr',
  },
  lastIssue: {
    Header: () => t('Last Issue'),
    Cell: ({value}) => <IssueCell group={value} />,
    width: '1.5fr',
  },
  owner: {
    Header: () => t('Assignee'),
    Cell: ({value}) => <MonitorOwner owner={value} />,
    width: '1fr',
  },
});

function MonitorOwner({owner}: {owner: string | null}) {
  if (!owner) {
    return t('Unassigned');
  }

  const [ownerType, ownerId] = owner.split(':');
  if (!ownerId || (ownerType !== 'user' && ownerType !== 'team')) {
    return t('Unknown Owner');
  }
  return <ActorBadge actor={{id: ownerId, name: '', type: ownerType}} />;
}

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
