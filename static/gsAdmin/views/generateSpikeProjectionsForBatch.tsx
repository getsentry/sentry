import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getFormat} from 'sentry/utils/dates';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getCells} from 'sentry/utils/regions';

import {PageHeader} from 'admin/components/pageHeader';

export function GenerateSpikeProjectionsForBatch() {
  const [batchId, setBatchId] = useState<number | null>(null);
  const cells = getCells();
  const [cell, setCell] = useState(cells[0] ?? null);

  const {mutate} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: `/_admin/cells/${cell?.name}/queue-spike-projection-batch/`,
        method: 'POST',
        data: {
          batch_id: batchId,
        },
        options: {
          host: cell?.locality_url,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(`Queued spike projection generation task for batch ${batchId}.`);
      setBatchId(null);
    },
    onError: () => {
      addErrorMessage(
        `Failed to queue spike projection generation task for batch ${batchId}.`
      );
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutate();
  };

  const batchRunTime = useMemo(() => {
    if (batchId === null || batchId < 0 || batchId > 143 || !Number.isInteger(batchId)) {
      return null;
    }
    return moment
      .utc()
      .startOf('day')
      .startOf('hour')
      .startOf('minute')
      .startOf('second')
      .add(batchId * 10, 'minutes');
  }, [batchId]);

  return (
    <div>
      <PageHeader title="Generate Spike Projections For Batch" />
      <Column onSubmit={handleSubmit}>
        <p>
          This will queue a task to generate spike projections for the next 7 days for the
          specified batch of customers in the specified region.
        </p>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={cell ? cell.locality_url : undefined}
          options={cells.map(c => ({
            label: c.name,
            value: c.locality_url,
          }))}
          onChange={opt => {
            const cellOption = cells.find(c => c.locality_url === opt.value);
            if (cellOption === undefined) {
              return;
            }
            setCell(cellOption);
          }}
        />
        <label htmlFor="batchId">Batch ID:</label>
        <BatchInput
          type="number"
          id="batchId"
          name="batchId"
          value={batchId === null ? '' : batchId}
          onChange={e => {
            const value = e.target.value;
            if (value === '') {
              setBatchId(null);
            } else {
              setBatchId(Number(value));
            }
          }}
          min={0}
          max={143}
          placeholder="0-143"
        />
        <BatchRunTime>
          (Batch Run Time:{' '}
          {batchRunTime
            ? batchRunTime.format(
                getFormat({
                  timeOnly: true,
                  timeZone: true,
                })
              )
            : 'N/A'}
          )
        </BatchRunTime>
        <Button
          variant="primary"
          type="submit"
          disabled={batchId === null || cell === null}
        >
          Submit
        </Button>
      </Column>
    </div>
  );
}

const Column = styled('form')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  > * {
    margin: 0;
  }
  > button {
    width: fit-content;
  }
`;

const BatchInput = styled(Input)`
  width: 100px;
`;

const BatchRunTime = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
`;
