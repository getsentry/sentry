import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeAndOp,
  type UptimeHeaderCheckOp,
  type UptimeJsonPathOp,
  type UptimeOp,
  type UptimeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

interface AddOpButtonProps extends Omit<DropdownMenuProps, 'items'> {
  /**
   * Callback when an operation type is selected
   */
  onAddOp: (op: UptimeOp) => void;
}

export function AddOpButton({onAddOp, ...dropdownProps}: AddOpButtonProps) {
  const menuItems: MenuItemProps[] = [
    {
      key: 'status_code',
      label: t('Status Code'),
      details: t('Check HTTP response status code'),
      onAction: () => {
        const statusCodeOp: UptimeStatusCodeOp = {
          id: uniqueId(),
          op: UptimeOpType.STATUS_CODE_CHECK,
          operator: {cmp: UptimeComparisonType.EQUALS},
          value: 200,
        };
        onAddOp(statusCodeOp);
      },
    },
    {
      key: 'json_path',
      label: t('JSON Path'),
      details: t('Validate JSON response body content'),
      onAction: () => {
        const jsonPathOp: UptimeJsonPathOp = {
          id: uniqueId(),
          op: UptimeOpType.JSON_PATH,
          value: '',
          operator: {cmp: UptimeComparisonType.EQUALS},
          operand: {jsonpath_op: 'literal', value: ''},
        };
        onAddOp(jsonPathOp);
      },
    },
    {
      key: 'header',
      label: t('Header'),
      details: t('Check HTTP response header values'),
      onAction: () => {
        const headerOp: UptimeHeaderCheckOp = {
          id: uniqueId(),
          op: UptimeOpType.HEADER_CHECK,
          key_op: {cmp: UptimeComparisonType.EQUALS},
          key_operand: {header_op: 'literal', value: ''},
          value_op: {cmp: UptimeComparisonType.EQUALS},
          value_operand: {header_op: 'literal', value: ''},
        };
        onAddOp(headerOp);
      },
    },
    {
      key: 'group',
      label: t('Logical Group'),
      details: t('Combine multiple assertions with AND/OR logic'),
      onAction: () => {
        const andOp: UptimeAndOp = {
          id: uniqueId(),
          op: UptimeOpType.AND,
          children: [],
        };
        onAddOp(andOp);
      },
    },
  ];

  return (
    <DropdownMenu
      items={menuItems}
      size="sm"
      {...dropdownProps}
      triggerProps={{
        'aria-label': t('Add Assertion'),
        showChevron: false,
        ...dropdownProps.triggerProps,
      }}
    />
  );
}
