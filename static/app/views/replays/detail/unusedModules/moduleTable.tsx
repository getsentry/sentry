import {Fragment} from 'react';
import styled from '@emotion/styled';

import FileSize from 'sentry/components/fileSize';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {MODULES_WITH_SIZE} from 'sentry/views/replays/detail/unusedModules/utils';

function ModuleTable({
  emptyMessage,
  modules,
  title,
}: {
  emptyMessage: React.ReactNode;
  modules: string[];
  title: React.ReactNode;
}) {
  const columns = [
    <SortItem key="chunk">{t('Module')}</SortItem>,
    <SortItem key="size">{t('Size')}</SortItem>,
  ];

  return (
    <details>
      <Summary>{title}</Summary>
      <StyledPanelTable
        columns={columns.length}
        isEmpty={!modules.length}
        emptyMessage={emptyMessage}
        headers={columns}
        disablePadding
        stickyHeaders
      >
        {modules.map(module => {
          const size = MODULES_WITH_SIZE[module];
          return (
            <Fragment key={module}>
              <Item>
                <Tooltip
                  title={module}
                  isHoverable
                  overlayStyle={{
                    maxWidth: '500px !important',
                  }}
                  showOnlyOnOverflow
                >
                  <Text>{module}</Text>
                </Tooltip>
              </Item>
              <Item numeric>
                <FileSize base={2} bytes={Math.round(size)} />
              </Item>
            </Fragment>
          );
        })}
      </StyledPanelTable>
    </details>
  );
}

const Summary = styled('summary')`
  cursor: pointer;
`;

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: 1fr max-content;
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
    &:nth-child(${p => p.columns}n) {
      justify-content: end;
      align-items: flex-start;
      text-align: end;
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

const Text = styled('p')`
  padding: 0;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

export default ModuleTable;
