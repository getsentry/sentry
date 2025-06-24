import type {Dispatch, SetStateAction} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
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

  return (
    <SimpleTableWithColumns>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell name="name">{t('Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="type">{t('Type')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="lastIssue">
          {t('Last Issue')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="owner">{t('Assignee')}</SimpleTable.HeaderCell>
        {canEdit && (
          <SimpleTable.HeaderCell name="connected">
            {t('Connected')}
          </SimpleTable.HeaderCell>
        )}
      </SimpleTable.Header>
      {data.length === 0 && (
        <SimpleTable.Empty>{t('No monitors connected')}</SimpleTable.Empty>
      )}
      {data.map(row => (
        <SimpleTable.Row key={row.title.name}>
          <SimpleTable.RowCell name="name">
            <TitleCell
              name={row.title.name}
              createdBy={row.title.createdBy}
              projectId={row.title.projectId}
              link={row.title.link}
            />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell name="type">
            <DetectorTypeCell type={row.type} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell name="lastIssue">
            <IssueCell group={row.lastIssue} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell name="owner">
            <MonitorOwner owner={row.owner} />
          </SimpleTable.RowCell>
          {canEdit && (
            <SimpleTable.RowCell name="connected">
              <Button onClick={row.connected?.toggleConnected}>
                {row.connected?.isConnected ? t('Disconnect') : t('Connect')}
              </Button>
            </SimpleTable.RowCell>
          )}
        </SimpleTable.Row>
      ))}
    </SimpleTableWithColumns>
  );
}

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

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 4fr 1fr 1.5fr 1fr 1fr;
`;
