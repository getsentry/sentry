import type {Dispatch, SetStateAction} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';

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

  return (
    <Container>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="type">
            {t('Type')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="last-issue">
            {t('Last Issue')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="owner">
            {t('Assignee')}
          </SimpleTable.HeaderCell>
          {canEdit && <SimpleTable.HeaderCell data-column-name="connected" />}
        </SimpleTable.Header>
        {monitors.length === 0 && (
          <SimpleTable.Empty>{t('No monitors connected')}</SimpleTable.Empty>
        )}
        {monitors.map(monitor => (
          <SimpleTable.Row key={monitor.id}>
            <SimpleTable.RowCell>
              <DetectorLink detector={monitor} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="type">
              <DetectorTypeCell type={monitor.type} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="last-issue">
              <IssueCell group={undefined} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="owner">
              <DetectorAssigneeCell assignee={monitor.owner} />
            </SimpleTable.RowCell>
            {canEdit && (
              <SimpleTable.RowCell data-column-name="connected" justify="flex-end">
                <Button onClick={() => toggleConnected(monitor.id)} size="sm">
                  {connectedIds?.has(monitor.id) ? t('Disconnect') : t('Connect')}
                </Button>
              </SimpleTable.RowCell>
            )}
          </SimpleTable.Row>
        ))}
      </SimpleTableWithColumns>
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 100px auto auto auto;

  margin-bottom: ${space(2)};

  /*
    The connected column can be added/removed depending on props, so in order to
    have a constant width we have an auto grid column and set the width here.
  */
  [data-column-name='connected'] {
    width: 140px;
  }

  @container (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr 100px auto auto;

    [data-column-name='last-issue'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 100px auto;

    [data-column-name='owner'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr 100px;

    [data-column-name='type'] {
      display: none;
    }
  }
`;
