import {Fragment} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {ColorOrAlias} from 'sentry/utils/theme';
import {ChunkInvocation} from 'sentry/views/replays/detail/filesize/utils';
import type {WebpackChunk} from 'sentry/views/replays/detail/unusedModules/utils';

import webpackStats from '../../../../../../mock_chunk_data.json';

type Props = {
  invocations: ChunkInvocation[];
};

function NetworkList({invocations}: Props) {
  const columns = [
    <SortItem key="trace">{t('Trace')}</SortItem>,
    <SortItem key="chunk">{t('Chunk')}</SortItem>,
    <SortItem key="size">{t('Size')}</SortItem>,
  ];

  const renderTransaction = (invocation: ChunkInvocation, index: number) => {
    return (
      <Fragment key={index}>
        <Item>{invocation.transaction}</Item>
        <Item>{invocation.filename}</Item>
        <Item numeric>
          <FileSize bytes={invocation.size} />
        </Item>
      </Fragment>
    );
  };

  return (
    <Fragment>
      <ChunkList invocations={invocations} />
      <StyledPanelTable
        columns={columns.length}
        isEmpty={Object.keys(invocations).length === 0}
        emptyMessage={t('No related network requests found.')}
        headers={columns}
        disablePadding
        stickyHeaders
      >
        {invocations.flatMap(renderTransaction) || null}
      </StyledPanelTable>
    </Fragment>
  );
}

type ChunkListProps = {
  invocations: ChunkInvocation[];
};
function ChunkList({invocations}: ChunkListProps) {
  const invokedFilenames = invocations.map(invocation => invocation.filename);

  const hasInvokedFile = (modules: string[]) => {
    return invokedFilenames.some(filename => modules.includes(filename));
  };

  return (
    <ul>
      {(webpackStats as WebpackChunk[]).map(chunk => {
        const moduleIds = chunk.modules.map(module => module.id);
        const open = hasInvokedFile(moduleIds);

        return (
          <li key={chunk.id}>
            <details open={open}>
              <summary>{chunk.id}</summary>
              <ul>
                {chunk.modules.map(module => (
                  <Module key={module.id} invoked={hasInvokedFile([module.id])}>
                    {module.id} <FileSize base={2} bytes={module.size} />
                  </Module>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

const Module = styled('li')<{invoked: boolean}>`
  ${p =>
    p.invoked
      ? `
        font-weight: bold;
        color: blue;
        `
      : null}
`;

const Item = styled('div')<{center?: boolean; color?: ColorOrAlias; numeric?: boolean}>`
  display: flex;
  align-items: center;
  ${p => p.center && 'justify-content: center;'}
  max-height: 28px;
  color: ${p => p.theme[p.color || 'subText']};
  padding: ${space(0.75)} ${space(1.5)};
  background-color: ${p => p.theme.background};

  ${p => p.numeric && 'font-variant-numeric: tabular-nums;'}
`;

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: max-content minmax(200px, 1fr) max-content;
  grid-template-rows: 24px repeat(auto-fit, 28px);
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  height: 100%;
  overflow: auto;

  > * {
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-bottom: 1px solid ${p => p.theme.innerBorder};

    /* Last column */
    &:nth-child(${p => p.columns}n) {
      border-right: 0;
      text-align: right;
      justify-content: end;
    }
  }

  ${/* sc-selector */ PanelTableHeader} {
    min-height: 24px;
    border-radius: 0;
    color: ${p => p.theme.subText};
    line-height: 16px;
    text-transform: none;

    /* Last, 2nd and 3rd last header columns. As these are flex direction columns we have to treat them separately */
    &:nth-child(${p => p.columns}n),
    &:nth-child(${p => p.columns}n - 1),
    &:nth-child(${p => p.columns}n - 2) {
      justify-content: center;
      align-items: flex-start;
      text-align: start;
    }
  }
`;

const SortItem = styled('span')`
  padding: ${space(0.5)} ${space(1.5)};
  width: 100%;

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkList;
