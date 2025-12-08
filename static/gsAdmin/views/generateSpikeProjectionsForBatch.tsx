import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import ConfigStore from 'sentry/stores/configStore';
import type {Region} from 'sentry/types/system';
import {getFormat} from 'sentry/utils/dates';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

import PageHeader from 'admin/components/pageHeader';

function GenerateSpikeProjectionsForBatch() {
  const [batchId, setBatchId] = useState<number | null>(null);
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState<Region | null>(regions[0] ?? null);

  const {mutate} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        // TODO(cells): Switch from region name to cell
        url: `/_admin/cells/${region?.name}/queue-spike-projection-batch/`,
        method: 'POST',
        data: {
          batch_id: batchId,
        },
        options: {
          host: region?.url,
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
          triggerProps={{prefix: 'Region'}}
          value={region ? region.url : undefined}
          options={regions.map((r: any) => ({
            label: r.name,
            value: r.url,
          }))}
          onChange={opt => {
            const regionOption = regions.find((r: any) => r.url === opt.value);
            if (regionOption === undefined) {
              return;
            }
            setRegion(regionOption);
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
          priority="primary"
          type="submit"
          disabled={batchId === null || region === null}
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
  font-size: ${p => p.theme.fontSize.sm};
`;

export default GenerateSpikeProjectionsForBatch;
