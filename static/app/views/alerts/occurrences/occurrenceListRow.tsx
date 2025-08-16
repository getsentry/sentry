import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link/link';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Text from 'sentry/components/text';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateEscalationPolicyState} from 'sentry/views/escalationPolicies/mutations/useUpdateEscalationPolicyState';
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
};

export function OccurrenceListRow({escalationPolicyState}: Props) {
  const org = useOrganization();

  const {mutateAsync: updateEscalationPolicyState} = useUpdateEscalationPolicyState({});

  const handleStatusChange = async (id: number, state: EscalationPolicyStateTypes) => {
    await updateEscalationPolicyState({
      escalationPolicyStateId: id,
      orgSlug: org.slug,
      state,
    });

    return id + status;
  };

  const actions: MenuItemProps[] = [
    {
      key: 'acknowledge',
      label: t('Acknowledge'),
      hidden: escalationPolicyState.state === 'acknowledged',
      onAction: () => {
        handleStatusChange(escalationPolicyState.id, 'acknowledged');
      },
    },
    {
      key: 'unacknowledge',
      label: t('Unacknowledge'),
      hidden: escalationPolicyState.state === 'unacknowledged',
      onAction: () => {
        handleStatusChange(escalationPolicyState.id, 'unacknowledged');
      },
    },
    {
      key: 'resolve',
      label: t('Resolve'),
      hidden: escalationPolicyState.state === 'resolved',
      priority: 'primary',
      onAction: () => {
        handleStatusChange(escalationPolicyState.id, 'resolved');
      },
    },
  ];

  return (
    <ErrorBoundary>
      <OccurrenceNameWrapper>
        <Link to={`/organizations/${org.slug}/issues/` + escalationPolicyState.group.id}>
          {escalationPolicyState.group.title}
        </Link>
      </OccurrenceNameWrapper>
      <EscalationPolicyStateBadge
        state={escalationPolicyState.state}
        loading={isStatusLoading}
      />
      <StyledTimeSince date={escalationPolicyState.dateAdded} />
      <StyledText>{escalationPolicyState.escalationPolicy.name}</StyledText>

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

function EscalationPolicyStateBadge({
  state,
  loading,
}: {
  loading: boolean;
  state: EscalationPolicyStateTypes;
}) {
  const innerText =
    state === 'unacknowledged'
      ? t('Unacked')
      : state === 'acknowledged'
        ? t('Acked')
        : t('Resolved');

  const tagType = loading
    ? 'default'
    : state === 'unacknowledged'
      ? 'error'
      : state === 'acknowledged'
        ? 'warning'
        : 'success';

  return (
    <div style={{display: 'block'}}>
      <StyledTag
        type={tagType}
        icon={
          loading && (
            <Fragment>
              <StyledLoadingIndicator mini relative size={16} />
            </Fragment>
          )
        }
      >
        {!loading && innerText}
      </StyledTag>
    </div>
  );
}

const StyledTag = styled(Tag)`
  span {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
  }

  & > div {
    height: 24px;
    padding: ${space(1)};
  }
`;

const OccurrenceNameWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis}
  display: flex;
  align-items: center;
  width: fit-content;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0;
`;

const StyledTimeSince = styled(TimeSince)`
  display: flex;
  align-items: center;
`;

const StyledText = styled(Text)`
  display: flex;
  align-items: center;
`;
