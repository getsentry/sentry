import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import ExternalLink from 'sentry/components/links/externalLink';
import {space} from 'sentry/styles/space';

import DropdownActions from 'admin/components/dropdownActions';
import ResultGrid from 'admin/components/resultGrid';
import type {Policy, PolicyRevision} from 'getsentry/types';

type Props = {
  onUpdate: (data: Record<string, any>, version: PolicyRevision['version']) => void;
  policy: Policy;
};

type RowProps = Props & {row: PolicyRevision};

const getRow = ({row, policy, onUpdate}: RowProps) => {
  return [
    <td key="version">
      <strong>{row.version}</strong>
      {row.version === policy.version && <CurrentTag>current</CurrentTag>}
      {row.url ? (
        <div>
          <ExternalLink href={row.url}>{row.url}</ExternalLink>
        </div>
      ) : null}
      {row.file ? (
        <FileName>
          {row.file.name} ({row.file.checksum})
        </FileName>
      ) : null}
    </td>,
    <td key="date" style={{textAlign: 'right'}}>
      {moment(row.createdAt).format('MMMM YYYY')}
      <br />
    </td>,
    <td key="actions" data-test-id="revision-actions">
      <DropdownActions
        actions={[
          {
            key: 'make-current',
            name: 'Make current',
            help: 'Make this the active version of this policy.',
            skipConfirmModal: true,
            disabled: policy.version === row.version,
            onAction: () => onUpdate({current: true}, row.version),
          },
        ]}
      />
    </td>,
  ];
};

function PolicyRevisions({policy, onUpdate}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Revisions"
      path={`/_admin/policies/${policy.slug}/revisions/`}
      endpoint={`/policies/${policy.slug}/revisions/`}
      method="GET"
      columns={[
        <th key="customer">Version</th>,
        <th key="date" style={{width: 200, textAlign: 'right'}}>
          Date Created
        </th>,
        <th key="actions" style={{width: 50}} />,
      ]}
      columnsForRow={row => getRow({row, policy, onUpdate})}
      defaultParams={{
        per_page: 10,
      }}
      useQueryString={false}
    />
  );
}

const CurrentTag = styled(Tag)`
  margin-left: ${space(1)};
`;

const FileName = styled('div')`
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default PolicyRevisions;
