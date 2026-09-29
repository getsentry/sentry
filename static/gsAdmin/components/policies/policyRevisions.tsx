import {useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {ResultTable} from 'sentry/components/resultTable';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';

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
        tooltipProps={{
          title:
            policy.version === row.version
              ? 'This is already the current version'
              : 'Make this the active version of this policy.',
        }}
        disabled={policy.version === row.version}
        onClick={() => onUpdate({current: true}, row.version)}
      >
        Make current
      </Button>
    </td>,
  ];
};

export function PolicyRevisions({policy, onUpdate}: Props) {
  const [cursor, setCursor] = useState<string | undefined>();
  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<PolicyRevision[]>()('/policies/$policySlug/revisions/', {
      path: {policySlug: policy.slug},
      query: {cursor, per_page: 10},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });

  return (
    <Panel>
      <PanelHeader>Revisions</PanelHeader>
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError onRetry={refetch} />
      ) : data.json.length === 0 ? (
        <EmptyMessage>No revisions found.</EmptyMessage>
      ) : (
        <ResultTable>
          <thead>
            <tr>
              <th>Version</th>
              <th style={{width: 200, textAlign: 'right'}}>Date Created</th>
              <th style={{width: 50}} />
            </tr>
          </thead>
          <tbody>
            {data.json.map(row => (
              <tr key={row.version}>{getRow({row, policy, onUpdate})}</tr>
            ))}
          </tbody>
        </ResultTable>
      )}
      <Pagination
        pageLinks={data?.headers.Link}
        onCursor={nextCursor => setCursor(nextCursor)}
      />
    </Panel>
  );
}

const CurrentTag = styled(Tag)`
  margin-left: ${p => p.theme.space.md};
`;

const FileName = styled('div')`
  margin-top: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
`;
