import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {space} from 'sentry/styles/space';

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
      {row.version === policy.version && <CurrentTag variant="muted">current</CurrentTag>}
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
      <Button
        title={
          policy.version === row.version
            ? 'This is already the current version'
            : 'Make this the active version of this policy.'
        }
        disabled={policy.version === row.version}
        onClick={() => onUpdate({current: true}, row.version)}
      >
        Make current
      </Button>
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
  font-size: ${p => p.theme.fontSize.sm};
`;

export default PolicyRevisions;
