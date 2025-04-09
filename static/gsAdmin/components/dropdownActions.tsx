import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';

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

/**
 * Map actions to a format that can be used by the CompactSelect component. This exists
 * because this used a component with a different signature, and I
 */
function mapActionsToCompactSelect(
  actions: Props['actions']
): Array<SelectOption<string>> {
  return actions.map(action => ({
    value: action.key,
    label: action.name,
    details: action.help,
    disabled: action.disabled,
    tooltip: action.disabled ? action.disabledReason : undefined,
    help: action.help,
  }));
}

function DropdownActions({actions, label}: Props) {
  return (
    <CompactSelect
      searchable
      options={mapActionsToCompactSelect(actions)}
      onChange={option => {
        const action = actions.find(a => a.key === option.value);
        if (!action || action.disabled) {
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
      triggerLabel={label}
    />
  );
}

export default DropdownActions;
