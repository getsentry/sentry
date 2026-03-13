import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import Confirm from 'sentry/components/confirm';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {singleLineRenderer} from 'sentry/utils/marked/marked';

import type {JsonFormAdapterFieldConfig} from './types';

type TableConfig = Extract<JsonFormAdapterFieldConfig, {type: 'table'}>;
type TableValue = Array<Record<string, unknown>>;

interface TableHeaderRowProps {
  config: TableConfig;
  onAdd: (newValue: TableValue) => void;
  value: TableValue;
  disabled?: boolean;
  indicator?: React.ReactNode;
}

interface TableBodyProps {
  config: TableConfig;
  onSave: () => void;
  onUpdate: (newValue: TableValue) => void;
  value: TableValue;
  disabled?: boolean;
}

/**
 * Renders the "Add" button for the table field.
 * Placed inside Layout.Row alongside the label.
 */
export function TableHeaderRow({
  config,
  value,
  onAdd,
  indicator,
  disabled,
}: TableHeaderRowProps) {
  const columnKeys = config.columnKeys ?? [];
  const emptyRow: Record<string, unknown> = {id: ''};
  for (const key of columnKeys) {
    emptyRow[key] = '';
  }

  const addRow = () => {
    onAdd([...value, emptyRow]);
  };

  return (
    <Flex align="center" gap="sm">
      <Button icon={<IconAdd />} onClick={addRow} size="xs" disabled={disabled}>
        {config.addButtonText ?? t('Add Item')}
      </Button>
      {indicator}
    </Flex>
  );
}

/**
 * Renders the table header labels + editable data rows.
 * Placed below the Layout.Row.
 */
export function TableBody({config, value, onUpdate, onSave, disabled}: TableBodyProps) {
  const columnKeys = config.columnKeys ?? [];
  const columnLabels = config.columnLabels ?? {};

  if (value.length === 0) {
    return null;
  }

  const allNonIdFieldsFilled = (rows: TableValue): boolean =>
    rows.every(row =>
      columnKeys.every(
        key => row[key] !== '' && row[key] !== null && row[key] !== undefined
      )
    );

  const handleCellChange = (rowIndex: number, key: string, cellValue: string) => {
    const newValue = value.map((row, i) =>
      i === rowIndex ? {...row, [key]: cellValue} : row
    );
    onUpdate(newValue);
    if (allNonIdFieldsFilled(newValue)) {
      onSave();
    }
  };

  const handleDelete = (rowIndex: number) => {
    const newValue = value.filter((_, i) => i !== rowIndex);
    onUpdate(newValue);
    onSave();
  };

  const renderConfirmMessage = () => (
    <Fragment>
      <span
        dangerouslySetInnerHTML={{
          __html: singleLineRenderer(
            config.confirmDeleteMessage ?? t('Are you sure you want to delete this item?')
          ),
        }}
      />
    </Fragment>
  );

  return (
    <Stack gap="lg">
      <Flex align="center" gap="md">
        {columnKeys.map(key => (
          <Flex flex="1 0 0" key={key}>
            <Text variant="muted" size="xs" uppercase>
              {columnLabels[key]}
            </Text>
          </Flex>
        ))}
      </Flex>
      {value.map((row, rowIndex) => (
        <Flex align="center" gap="md" key={rowIndex}>
          {columnKeys.map(key => (
            <Flex flex="1 0 0" key={key}>
              <Input
                value={(row[key] as string) ?? ''}
                onChange={e => handleCellChange(rowIndex, key, e.currentTarget.value)}
                disabled={disabled}
              />
            </Flex>
          ))}
          <Confirm
            priority="danger"
            disabled={disabled}
            onConfirm={() => handleDelete(rowIndex)}
            message={renderConfirmMessage()}
          >
            <Button
              icon={<IconDelete />}
              size="sm"
              disabled={disabled}
              aria-label={t('Delete')}
            />
          </Confirm>
        </Flex>
      ))}
    </Stack>
  );
}
