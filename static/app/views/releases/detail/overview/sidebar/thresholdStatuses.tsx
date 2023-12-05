import {useMemo} from 'react';
import styled from '@emotion/styled';

import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getExactDuration} from 'sentry/utils/formatters';

import {Table, TableRow} from '../../../components/sideTable';
import {ThresholdStatus} from '../../../utils/types';

type Props = {
  thresholdStatuses?: ThresholdStatus[];
};

function ThresholdStatuses({thresholdStatuses}: Props) {
  const sortedThreshold: ThresholdStatus[] = useMemo(() => {
    return (
      thresholdStatuses?.sort((a, b) => {
        const keyA: string = a.environment ? a.environment.name : '';
        const keyB: string = b.environment ? b.environment.name : '';

        return keyA.localeCompare(keyB);
      }) || []
    );
  }, [thresholdStatuses]);

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Threshold Statuses')}</SidebarSection.Title>
      <SidebarSection.Content>
        <Table>
          {sortedThreshold?.map(status => (
            <TableRow key={status.id} type={status.is_healthy ? undefined : 'error'}>
              <RowGrid>
                <div>{status.environment?.name}</div>
                <div>{getExactDuration(status.window_in_seconds, true, 'seconds')}</div>
                <div>
                  {status.threshold_type} {status.trigger_type === 'over' ? '>' : '<'}{' '}
                  {status.value}
                </div>
                <AlignRight>
                  {status.is_healthy ? (
                    <IconCheckmark color="successText" size="xs" />
                  ) : (
                    <IconWarning color="errorText" size="xs" />
                  )}
                </AlignRight>
              </RowGrid>
            </TableRow>
          ))}
        </Table>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const AlignRight = styled('div')`
  text-align: right;
`;

const RowGrid = styled('div')`
  display: grid;
  grid-template-columns: 0.5fr 0.5fr max-content 0.1fr;
  gap: ${space(1)};
`;

export default ThresholdStatuses;
