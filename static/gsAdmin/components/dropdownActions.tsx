import {css} from '@emotion/react';
import styled from '@emotion/styled';

import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {Tooltip} from 'sentry/components/tooltip';
import {IconNot} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';

const ActionName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActionLabel = styled('div')<{isDisabled: boolean}>`
  width: 350px;
  ${p =>
    p.isDisabled &&
    css`
      color: ${p.theme.subText};
      svg {
        color: ${p.theme.red200};
      }
    `}
`;

const HelpText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.2;
`;

type Props = {
  actions: Array<{
    key: string;
    name: string;
    onAction: (params: any) => void;
    confirmModalOpts?: any;
    disabled?: boolean;
    disabledReason?: string;
    help?: string;
    skipConfirmModal?: boolean;
    visible?: boolean;
  }>;
  label?: string;
};

function DropdownActions({actions, label}: Props) {
  return (
    <DropdownAutoComplete
      alignMenu="right"
      searchPlaceholder="Filter actions"
      noResultsMessage="No actions match your filter"
      onSelect={({value}) => {
        const action = actions.find(a => a.key === value);

        if (action === undefined) {
          return;
        }

        if (action.disabled) {
          return;
        }

        if (action.skipConfirmModal) {
          action.onAction({});
          return;
        }

        const {confirmModalOpts} = action;
        const {header, modalSpecificContent, showAuditFields} = confirmModalOpts ?? {};

        // We provide some defaults for the openAdminConfirmModal call. But
        // those defaults may be overridden
        openAdminConfirmModal({
          ...confirmModalOpts,
          header: header ?? <h4>{action.name}</h4>,
          modalSpecificContent: modalSpecificContent ?? action.help,
          showAuditFields: showAuditFields ?? true,
          onConfirm: action.onAction,
        });
      }}
      items={actions
        .filter(action => action.visible !== false)
        .map(action => {
          const actionLabel = (
            <ActionLabel
              data-test-id={`action-${action.key}`}
              isDisabled={!!action.disabled}
              aria-disabled={!!action.disabled}
            >
              <ActionName>
                {action.name}
                {action.disabled && (
                  <Tooltip skipWrapper title={action.disabledReason}>
                    <IconNot size="xs" data-test-id="icon-not" />
                  </Tooltip>
                )}
              </ActionName>
              {action.help && <HelpText>{action.help}</HelpText>}
            </ActionLabel>
          );

          return {
            value: action.key,
            searchKey: action.name,
            label: actionLabel,
          };
        })}
    >
      {({isOpen}) => (
        <DropdownButton data-test-id="detail-actions" size="sm" isOpen={isOpen}>
          {label}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  );
}

export default DropdownActions;
