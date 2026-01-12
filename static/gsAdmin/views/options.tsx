import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconEdit, IconStack} from 'sentry/icons';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import EditAdminOptionModal from 'admin/components/editAdminOptionModal';
import PageHeader from 'admin/components/pageHeader';
import ResultGrid from 'admin/components/resultGrid';

type Props = RouteComponentProps<unknown, unknown>;

export interface SerializedOption {
  fieldType: 'bool' | 'rate';
  name: string;
  value: string | boolean | number;
  groupingInfo?: {
    name: string;
    order: number;
  };
}

const getRow = (row: SerializedOption, allRows: SerializedOption[]) => [
  <EditableOption key="option" row={row} allRows={allRows} path="/_admin/options/" />,
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
  if (row.groupingInfo && row.groupingInfo.order !== 0) {
    return null;
  }

  return (
    <Fragment>
      <td key="name">
        {row.groupingInfo ? (
          <Flex as="span" align="center" gap="md">
            {row.groupingInfo.name} <IconStack size="xs" />
          </Flex>
        ) : (
          row.name
        )}
      </td>
      <td key="value">
        {row.groupingInfo ? null : (
          <Flex justify="end" align="center" gap="md">
            {row.fieldType === 'rate' && isNum(row.value) ? (
              <FormattedValue>{`(${row.value * 100}%)`}</FormattedValue>
            ) : null}
            <span>{JSON.stringify(row.value)}</span>
          </Flex>
        )}
      </td>
      <td key="edit">
        <Button
          borderless
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
      </td>
    </Fragment>
  );
}

function Options(props: Props) {
  return (
    <div>
      <PageHeader title="Options" />
      <ResultGrid
        inPanel
        path="/_admin/options/"
        endpoint="/_admin/options/"
        method="GET"
        columns={[
          <th key="name">Option Name</th>,
          <th key="value" style={{textAlign: 'right'}}>
            Option Value
          </th>,
          <th key="edit" style={{width: 50, textAlign: 'right'}} />,
        ]}
        columnsForRow={getRow}
        hasSearch
        {...props}
      />
    </div>
  );
}

const FormattedValue = styled('span')`
  color: ${p => p.theme.gray400};
  opacity: 0.5;
`;

const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

function isNum(input: any): input is number {
  return typeof input === 'number' && !isNaN(input);
}

export default Options;
