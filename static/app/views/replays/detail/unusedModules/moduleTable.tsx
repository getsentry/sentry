import {Fragment, ReactNode, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FileSize from 'sentry/components/fileSize';
import {PanelTable, PanelTableHeader} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow, IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {ISortConfig, sortNetwork} from 'sentry/views/replays/detail/network/utils';
import {MODULES_WITH_SIZE} from 'sentry/views/replays/detail/unusedModules/utils';

enum TableMode {
  All,
  None,
  Unused,
  Used,
}
enum ModuleState {
  Used,
  Unused,
}

type Record = {
  name: string;
  size: number;
  state: ModuleState;
};

function getModules(
  mode: TableMode,
  sortConfig: ISortConfig<Record>,
  {usedModules, unusedModules}: {unusedModules: string[]; usedModules: string[]}
) {
  const used = usedModules.map(
    name =>
      ({
        name,
        size: MODULES_WITH_SIZE[name],
        state: ModuleState.Used,
      } as Record)
  );
  const unused = unusedModules.map(
    name =>
      ({
        name,
        size: MODULES_WITH_SIZE[name],
        state: ModuleState.Unused,
      } as Record)
  );

  switch (mode) {
    case TableMode.All:
      return sortNetwork([...used, ...unused], sortConfig);
    case TableMode.Used:
      return sortNetwork(used, sortConfig);
    case TableMode.Unused:
      return sortNetwork(unused, sortConfig);
    case TableMode.None:
    default:
      return [];
  }
}

function ModuleTable({
  emptyMessage,
  usedModules,
  unusedModules,
}: {
  emptyMessage: React.ReactNode;
  unusedModules: string[];
  usedModules: string[];
}) {
  const [mode, setMode] = useState<TableMode>(TableMode.None);
  const [sortConfig, setSortConfig] = useState<ISortConfig<Record>>({
    by: 'size',
    asc: false,
    getValue: row => row[sortConfig.by],
  });

  const handleSort = useCallback((fieldName: string) => {
    const getValueFunction = row => row[fieldName];

    setSortConfig(prevSort => {
      if (prevSort.by === fieldName) {
        return {by: fieldName, asc: !prevSort.asc, getValue: getValueFunction};
      }

      return {by: fieldName, asc: true, getValue: getValueFunction};
    });
  }, []);

  const sortArrow = (sortedBy: string) => {
    return sortConfig.by === sortedBy ? (
      <IconArrow
        color="gray300"
        size="xs"
        direction={sortConfig.by === sortedBy && !sortConfig.asc ? 'up' : 'down'}
      />
    ) : null;
  };

  const columns = [
    <SortItem key="state">
      <UnstyledHeaderButton onClick={() => handleSort('state')}>
        {t('In Use')} {sortArrow('state')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="name">
      <UnstyledHeaderButton onClick={() => handleSort('name')}>
        {t('Module')} {sortArrow('name')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="size">
      <UnstyledHeaderButton onClick={() => handleSort('size')}>
        {t('Size')} {sortArrow('size')}
      </UnstyledHeaderButton>
    </SortItem>,
  ];

  const modules = useMemo(
    () => getModules(mode, sortConfig, {unusedModules, usedModules}),
    [mode, sortConfig, unusedModules, usedModules]
  );

  const table = (
    <StyledPanelTable
      columns={columns.length}
      isEmpty={!modules.length}
      emptyMessage={emptyMessage}
      headers={columns}
      disablePadding
      stickyHeaders
    >
      {modules.map(module => {
        return (
          <Fragment key={module.name}>
            <Item center>
              {module.state === ModuleState.Used ? (
                <IconCheckmark color="green300" size="xs" isCircled />
              ) : (
                <IconClose color="red400" size="xs" isCircled />
              )}
            </Item>
            <Item>
              <Tooltip
                title={module.name}
                isHoverable
                overlayStyle={{
                  maxWidth: '500px !important',
                }}
                showOnlyOnOverflow
              >
                <Text>{module.name}</Text>
              </Tooltip>
            </Item>
            <Item numeric>
              <FileSize base={2} bytes={Math.round(module.size)} />
            </Item>
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );

  const buttons: [TableMode, ReactNode][] = [
    [TableMode.None, t('Hide')],
    [TableMode.All, t('All Imports')],
    [TableMode.Unused, t('Unused Imports')],
    [TableMode.Used, t('Accessed Imports')],
  ];

  return (
    <div>
      <ButtonBar merged>
        {buttons.map(([key, label]) => (
          <Button
            key={key}
            size="xs"
            onClick={() => setMode(key)}
            priority={mode === key ? 'primary' : 'default'}
          >
            {label}
          </Button>
        ))}
      </ButtonBar>
      {mode !== TableMode.None ? table : null}
    </div>
  );
}

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: max-content minmax(200px, 1fr) max-content;
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

const UnstyledButton = styled('button')`
  border: 0;
  background: none;
  padding: 0;
  text-transform: inherit;
  width: 100%;
  text-align: unset;
`;

const UnstyledHeaderButton = styled(UnstyledButton)`
  display: flex;
  justify-content: space-between;
  align-items: center;
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
