import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import Confirm from 'sentry/components/confirm';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {Flow} from '../types';

interface FlowsTableRowProps {
  flow: Flow;
  index: number;
  onDeleteFlow?: (flowId: string) => void;
}

export function FlowsTableRow({flow, index, onDeleteFlow}: FlowsTableRowProps) {
  return (
    <SimpleTable.Row key={flow.id || index} data-test-id={`row-${index}`}>
      <SimpleTable.RowCell>
        <Link to={`/codecov/flows/${flow.id}/`}>{flow.name}</Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell style={{textAlign: 'center'}}>
        {flow.createdBy ? (
          <Tooltip title={flow.createdBy.name || flow.createdBy.email}>
            <UserAvatar user={flow.createdBy} size={24} />
          </Tooltip>
        ) : (
          <Tooltip title={t('Sentry')}>
            <ActivityAvatar type="system" size={24} />
          </Tooltip>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell style={{textAlign: 'center'}}>
        {flow.status}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell style={{textAlign: 'center'}}>
        <LastSeenWrapper gap={space(0.5)}>
          <TimeSince
            date={flow.lastSeen}
            liveUpdateInterval={'second'}
            unitStyle="short"
            disabledAbsoluteTooltip={false}
          />
        </LastSeenWrapper>
      </SimpleTable.RowCell>
      {onDeleteFlow && (
        <SimpleTable.RowCell style={{textAlign: 'center'}}>
          <ActionsContainer>
            <Tooltip title={t('You do not have permission to delete flows')}>
              <Confirm
                message={t('Are you sure you want to delete this flow?')}
                onConfirm={() => onDeleteFlow(flow.id)}
              >
                <Button size="sm" icon={<IconDelete />} aria-label={t('Delete flow')} />
              </Confirm>
            </Tooltip>
          </ActionsContainer>
        </SimpleTable.RowCell>
      )}
    </SimpleTable.Row>
  );
}

const LastSeenWrapper = styled('div')<{gap: string}>`
  display: flex;
  align-items: center;
  gap: ${p => p.gap};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ActionsContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
