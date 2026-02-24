import {
  DropdownMenu,
  type DropdownMenuProps,
  type MenuItemProps,
} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import {
  ComparisonType,
  OpType,
  type AndOp,
  type HeaderCheckOp,
  type JsonPathOp,
  type Op,
  type StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

interface AddOpButtonProps extends Omit<DropdownMenuProps, 'items'> {
  /**
   * Callback when an operation type is selected
   */
  onAddOp: (op: Op) => void;
}

export function AddOpButton({onAddOp, ...dropdownProps}: AddOpButtonProps) {
  const menuItems: MenuItemProps[] = [
    {
      key: 'status_code',
      label: t('Status Code'),
      details: t('Check HTTP response status code'),
      onAction: () => {
        const statusCodeOp: StatusCodeOp = {
          id: uniqueId(),
          op: OpType.STATUS_CODE_CHECK,
          operator: {cmp: ComparisonType.EQUALS},
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
        const jsonPathOp: JsonPathOp = {
          id: uniqueId(),
          op: OpType.JSON_PATH,
          value: '',
          operator: {cmp: ComparisonType.EQUALS},
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
        const headerOp: HeaderCheckOp = {
          id: uniqueId(),
          op: OpType.HEADER_CHECK,
          key_op: {cmp: ComparisonType.EQUALS},
          key_operand: {header_op: 'literal', value: ''},
          value_op: {cmp: ComparisonType.EQUALS},
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
        const andOp: AndOp = {
          id: uniqueId(),
          op: OpType.AND,
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
