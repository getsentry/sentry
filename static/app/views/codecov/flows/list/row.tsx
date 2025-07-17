import Confirm from 'sentry/components/confirm';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

interface FlowsTableRowProps {
  flow: FlowDefinition;
  index: number;
  onDeleteFlow?: (flowId: string) => void;
}

export function FlowsTableRow({flow, onDeleteFlow}: FlowsTableRowProps) {
  return (
    <SimpleTable.Row data-test-id={`row-${flow.id}`}>
      <SimpleTable.RowCell>
        <Link to={`/codecov/flows/${flow.id}/`}>{flow.name}</Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Tooltip title={flow.createdBy.name || flow.createdBy.email}>
          <UserAvatar user={flow.createdBy} size={32} />
        </Tooltip>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>{flow.status}</SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {flow.lastSeen ? (
          <TimeSince
            date={flow.lastSeen}
            liveUpdateInterval={'second'}
            unitStyle="short"
            disabledAbsoluteTooltip={false}
          />
        ) : (
          <span>{t('Not seen yet')}</span>
        )}
      </SimpleTable.RowCell>
      {onDeleteFlow && (
        <SimpleTable.RowCell style={{textAlign: 'center'}}>
          <Confirm
            message={t('Are you sure you want to delete this flow?')}
            onConfirm={() => onDeleteFlow(flow.id)}
          >
            <Button size="sm" icon={<IconDelete />} aria-label={t('Delete flow')} />
          </Confirm>
        </SimpleTable.RowCell>
      )}
    </SimpleTable.Row>
  );
}
