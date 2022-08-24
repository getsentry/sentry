import {Fragment} from 'react';
import styled from '@emotion/styled';
import {last, mergeWith} from 'lodash';

import FileSize from 'sentry/components/fileSize';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import {ColorOrAlias} from 'sentry/utils/theme';
import {ChunkInvocation} from 'sentry/views/replays/detail/filesize/utils';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import {Codecov, ReplayRecord} from '../../types';

type Props = {
  accessed: Codecov[];
  imports: Codecov[];
  replayRecord: ReplayRecord;
};

function adder(objValue, srcValue) {
  if (typeof objValue === 'number') {
    return objValue + srcValue;
  }
}

function modulesByUrl(all: Codecov[], targetUrl?: string) {
  return (
    all
      // .filter(({url}) => url === targetUrl)
      .reduce(
        (acc, {url, timestamp, modules}) => {
          const [prevUrl, accData] = acc;

          const mergedModules = Object.values(modules).reduce((acc, module) => {
            if (!acc) {
              return module;
            }

            return mergeWith(acc, module, adder);
          }, null);

          if (url == prevUrl && accData?.length) {
            accData[accData.length - 1].modules = mergeWith(
              accData[accData.length - 1].modules,
              mergedModules,
              adder
            );
          } else {
            accData.push({
              timestamp,
              url,
              modules: mergedModules,
            });
          }

          return [url, accData];
        },
        [null, []]
      )
  );
}

function UnusedModules({replayRecord, imports, accessed}: Props) {
  const {currentTime, replay} = useReplayContext();
  if (!replay) {
    return null;
  }

  const startTimestampMs = replayRecord.startedAt.getTime();
  const currentTimeMs = startTimestampMs + Math.floor(currentTime);
  const currentUrl = getCurrentUrl(replayRecord, replay.getRawCrumbs(), currentTime);

  const columns = [
    <SortItem key="chunk">{t('Module')}</SortItem>,
    <SortItem key="size">{t('Size')}</SortItem>,
  ];

  const accessedByUrl = last(
    modulesByUrl(accessed)[1].filter(
      ({url, timestamp}) => url === currentUrl && currentTimeMs >= timestamp
    )
  );
  const importsByUrl = last(
    imports.filter(({url, timestamp}) => url === currentUrl && currentTimeMs >= timestamp)
  );

  const isEmpty = !accessedByUrl;

  const renderTransaction = (
    [module, exports]: [module: string, exports: Record<string, number>],
    index: number
  ) => {
    return (
      <Fragment key={index}>
        <Item>{module}</Item>
        <Item numeric>
          <FileSize bytes={0} />
        </Item>
      </Fragment>
    );
  };

  if (isEmpty) {
    return <EmptyMessage>{t('No import data available for current URL')}</EmptyMessage>;
  }

  const importedModules = Array.from(new Set(importsByUrl.modules));
  const importedModulesNotAccessed = importedModules.filter(
    module => !(module in accessedByUrl.modules)
  );
  const accessedModules = Object.entries(accessedByUrl.modules);

  return (
    <Fragment>
      <div>Current URL: {currentUrl}</div>
      <div>Imported Modules: {importedModules.length}</div>
      <div>Accessed Modules: {accessedModules.length}</div>
      <div>Unaccessed Modules: {importedModulesNotAccessed.length}</div>
      <div>
        Percent Unaccessed:{' '}
        {Math.round(
          (importedModulesNotAccessed.length / importedModules.length) * 10000
        ) / 100}
        %
      </div>

      <details open>
        <summary>Unaccessed Modules</summary>
        <StyledPanelTable
          columns={columns.length}
          isEmpty={!importedModulesNotAccessed.length}
          emptyMessage={t('No import data available')}
          headers={columns}
          disablePadding
          stickyHeaders
        >
          {importedModulesNotAccessed.map((module, i) => renderTransaction([module, {}], i))}
        </StyledPanelTable>
      </details>
      <details>
        <summary>Accessed Modules</summary>
        <StyledPanelTable
          columns={columns.length}
          isEmpty={!accessedModules.length}
          emptyMessage={t('No import data available')}
          headers={columns}
          disablePadding
          stickyHeaders
        >
          {accessedModules.map(renderTransaction)}
        </StyledPanelTable>
      </details>
    </Fragment>
  );
}

function ChunkList({chunks, invocations}) {
  const invokedFilenames = invocations.map(invocation => invocation.filename);

  const hasInvokedFile = (modules: string[]) => {
    return invokedFilenames.some(filename => modules.includes(filename));
  };

  return (
    <ul>
      {chunks.map(chunk => {
        const open = hasInvokedFile(chunk.modules);

        return (
          <li key={chunk}>
            <details open={open}>
              <summary>{chunk.chunkId}</summary>
              <ul>
                {chunk.modules.map(module => (
                  <Module key={module} invoked={hasInvokedFile([module])}>
                    {module}
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
  grid-template-columns: auto max-content;
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

export default UnusedModules;
