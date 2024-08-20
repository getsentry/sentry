import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  EscalationPolicyState,
  EscalationPolicyStateTypes,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicyStates';

/* COPIED FROM sentry/views/alerts/list/rules/row.tsx */

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
`;

/* END COPY */

type Props = {
  escalationPolicyState: EscalationPolicyState;
  onStatusChange: (id: number, state: EscalationPolicyStateTypes) => void;
};

export function OccurrenceListRow({escalationPolicyState, onStatusChange}: Props) {
  const actions: MenuItemProps[] = [
    {
      key: 'acknowledge',
      label: t('Acknowledge'),
      hidden: escalationPolicyState.state === 'acknowledged',
      onAction: () => {
        onStatusChange(escalationPolicyState.id, 'acknowledged');
      },
    },
    {
      key: 'unacknowledge',
      label: t('Unacknowledge'),
      hidden: escalationPolicyState.state === 'unacknowledged',
      onAction: () => {
        onStatusChange(escalationPolicyState.id, 'unacknowledged');
      },
    },
    {
      key: 'resolve',
      label: t('Resolve'),
      hidden: escalationPolicyState.state === 'resolved',
      // priority: 'danger',
      onAction: () => {
        onStatusChange(escalationPolicyState.id, 'resolved');
      },
    },
  ];

  return (
    <ErrorBoundary>
      <div>{escalationPolicyState.state}</div>
      <div>{escalationPolicyState.group.title}</div>
      <TimeSince date={escalationPolicyState.dateAdded} />
      <div>{escalationPolicyState.escalationPolicy.name}</div>

      <ActionsColumn>
        <Access access={['alerts:write']}>
          {({hasAccess}) => (
            <DropdownMenu
              items={actions}
              position="bottom-end"
              triggerProps={{
                'aria-label': t('Actions'),
                size: 'xs',
                icon: <IconEllipsis />,
                showChevron: false,
              }}
              disabledKeys={hasAccess ? [] : ['delete']}
            />
          )}
        </Access>
      </ActionsColumn>
    </ErrorBoundary>
  );
}
