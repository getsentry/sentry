import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconEdit} from '@sentry/icons/edit';
import {IconStack} from '@sentry/icons/stack';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {EditAdminOptionModal} from 'admin/components/editAdminOptionModal';
import {PageHeader} from 'admin/components/pageHeader';

export interface SerializedOption {
  fieldType: 'bool' | 'rate';
  name: string;
  value: string | boolean | number;
  groupingInfo?: {
    name: string;
    order: number;
  };
}

const getRow = (row: SerializedOption, allRows: SerializedOption[]) =>
  row.groupingInfo && row.groupingInfo.order !== 0
    ? []
    : [
        <EditableOption
          key="option"
          row={row}
          allRows={allRows}
          path="/_admin/options/"
        />,
      ];

function EditableOption({
  row,
  path,
  allRows,
}: {
  allRows: SerializedOption[];
  path: string;
  row: SerializedOption;
}) {
  const {openModal} = useModal();

  return (
    <Fragment>
      <SimpleTable.RowCell key="name">
        {row.groupingInfo ? (
          <Flex as="span" align="center" gap="md">
            {row.groupingInfo.name} <IconStack size="xs" />
          </Flex>
        ) : (
          row.name
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell key="value" justify="end">
        {row.groupingInfo ? null : (
          <Flex align="center" gap="md">
            {row.fieldType === 'rate' && isNum(row.value) ? (
              <FormattedValue>{`(${row.value * 100}%)`}</FormattedValue>
            ) : null}
            <span>{JSON.stringify(row.value)}</span>
          </Flex>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell key="edit">
        <Button
          variant="transparent"
          icon={<IconEdit size="xs" />}
          size="zero"
          aria-label="edit"
          onClick={() =>
            openModal(
              deps => (
                <EditAdminOptionModal
                  {...deps}
                  option={row}
                  allOptions={allRows}
                  path={path}
                />
              ),
              {
                modalCss,
              }
            )
          }
        />
      </SimpleTable.RowCell>
    </Fragment>
  );
}

export function Options() {
  return (
    <div>
      <PageHeader title="Options" />
      <ResultGrid
        inPanel
        path="/_admin/options/"
        endpoint="/_admin/options/"
        columns={[
          {key: 'name', label: 'Option Name'},
          {key: 'value', label: 'Option Value', align: 'right'},
          {key: 'edit', label: 'Edit', hideLabel: true, width: 50},
        ]}
        columnsForRow={getRow}
        hasSearch
      />
    </div>
  );
}

const FormattedValue = styled('span')`
  color: ${p => p.theme.colors.gray500};
  opacity: 0.5;
`;

const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

function isNum(input: any): input is number {
  return typeof input === 'number' && !isNaN(input);
}
