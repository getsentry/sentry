import {Fragment, ReactNode, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FileSize from 'sentry/components/fileSize';
import {Hovercard} from 'sentry/components/hovercard';
import {
  PanelHeader,
  PanelItem,
  PanelTable,
  PanelTableHeader,
} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {IconArrow, IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {inputStyles} from 'sentry/styles/input';
import space from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {ISortConfig, sortNetwork} from 'sentry/views/replays/detail/network/utils';
import {
  MODULES_WITH_CUMULATIVE_SIZE,
  MODULES_WITH_PARENTS,
  MODULES_WITH_SIZE,
} from 'sentry/views/replays/detail/unusedModules/utils';

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
  cumulative: number;
  incChildren: number;
  name: string;
  parents: string[];
  size: number;
  state: ModuleState;
};

function getModules(
  mode: TableMode,
  sortConfig: ISortConfig<Record>,
  filter: string,
  {usedModules, unusedModules}: {unusedModules: string[]; usedModules: string[]}
) {
  const used = uniq(usedModules)
    .filter(name => name.includes(filter))
    .filter(name => name !== '../mock_chunk_data.json')
    .map(
      name =>
        ({
          cumulative: (MODULES_WITH_CUMULATIVE_SIZE[name] || [0, 0])[1],
          incChildren: (MODULES_WITH_CUMULATIVE_SIZE[name] || [0, 0, 0])[2],
          name,
          parents: MODULES_WITH_PARENTS[name] || [],
          size: MODULES_WITH_SIZE[name] || 0,
          state: ModuleState.Used,
        } as Record)
    );
  const unused = uniq(unusedModules)
    .filter(name => name.includes(filter))
    .filter(name => name !== '../mock_chunk_data.json')
    .map(
      name =>
        ({
          cumulative: (MODULES_WITH_CUMULATIVE_SIZE[name] || [0, 0])[1],
          incChildren: (MODULES_WITH_CUMULATIVE_SIZE[name] || [0, 0, 0])[2],
          name,
          parents: MODULES_WITH_PARENTS[name] || [],
          size: MODULES_WITH_SIZE[name] || 0,
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
    by: 'cumulative',
    asc: false,
    getValue: row => row[sortConfig.by],
  });
  const [filter, setFilter] = useState('');

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
        {t('Used')} {sortArrow('state')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="name">
      <UnstyledHeaderButton onClick={() => handleSort('name')}>
        {t('Module')} {sortArrow('name')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="size">
      <UnstyledHeaderButton onClick={() => handleSort('size')}>
        {t('Ex. Size')} {sortArrow('size')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="cumulative">
      <UnstyledHeaderButton onClick={() => handleSort('cumulative')}>
        {t('Inc. Size')} {sortArrow('cumulative')}
      </UnstyledHeaderButton>
    </SortItem>,
    <SortItem key="children">
      <UnstyledHeaderButton onClick={() => handleSort('incChildren')}>
        {t('Inc. Deps')} {sortArrow('incChildren')}
      </UnstyledHeaderButton>
    </SortItem>,
  ];

  const modules = useMemo(
    () => getModules(mode, sortConfig, filter, {unusedModules, usedModules}),
    [mode, sortConfig, filter, unusedModules, usedModules]
  );

  const table = (
    <Fragment>
      {/* @ts-expect-error WTF is it complaining about theme for? */}
      <FilterInput
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={t('Filter by module name...')}
      />
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
                  <Text>
                    <ModuleParents module={module} />
                  </Text>
                </Tooltip>
              </Item>
              <Item numeric>
                <FileSize base={2} bytes={Math.round(module.size)} />
              </Item>
              <Item numeric>
                <FileSize base={2} bytes={Math.round(module.cumulative)} />
              </Item>
              <Item numeric>{formatAbbreviatedNumber(module.incChildren)}</Item>
            </Fragment>
          );
        })}
      </StyledPanelTable>
    </Fragment>
  );

  const buttons: [TableMode, ReactNode][] = [
    [TableMode.None, t('Hide')],
    [TableMode.All, t('All Imports')],
    [TableMode.Unused, t('Unused Imports')],
    [TableMode.Used, t('Accessed Imports')],
  ];

  const isTableVisible = mode !== TableMode.None;

  return (
    <div>
      <StyledButtonBar isTableVisible={isTableVisible} merged>
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
      </StyledButtonBar>
      {isTableVisible ? table : null}
    </div>
  );
}

const NoPaddingHovercard = styled(
  ({children, bodyClassName, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard bodyClassName={bodyClassName || '' + ' half-padding'} {...props}>
      {children}
    </Hovercard>
  )
)`
  .half-padding {
    padding: 0;
  }
`;

function ModuleParents({module}: {module: Record}) {
  const summaryItems = module.parents.map(parent => (
    <PanelItem key={parent}>
      <TextOverflow ellipsisDirection="left">{parent}</TextOverflow>
    </PanelItem>
  ));

  return (
    <NoPaddingHovercard
      body={
        <ScrollableCardBody>
          <PanelHeader>Parent Modules</PanelHeader>
          {summaryItems}
        </ScrollableCardBody>
      }
      position="right"
    >
      <TextOverflow>{module.name}</TextOverflow>
    </NoPaddingHovercard>
  );
}

const ScrollableCardBody = styled('div')`
  overflow: auto;
  max-height: 90vh;
`;

const StyledPanelTable = styled(PanelTable)<{columns: number}>`
  grid-template-columns: max-content minmax(200px, 1fr) repeat(3, max-content);
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
  height: 100%;
  overflow: auto;

  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom: none;
  border-top: none;

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

const StyledButtonBar = styled(ButtonBar)<{isTableVisible: boolean}>`
  margin: ${space(1)} 0;
  ${p =>
    p.isTableVisible
      ? `
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        `
      : null}
`;

const FilterInput = styled('input')`
  ${inputStyles};
  background-color: ${p => p.theme.white};

  border-radius: 0;

  padding: ${space(0.75)};
  height: ${p => p.theme.form.xs.height}px;
  min-height: ${p => p.theme.form.xs.minHeight}px;
  font-size: ${p => p.theme.form.xs.fontSize};
  line-height: ${p => p.theme.form.xs.lineHeight};

  &:hover,
  &:focus {
    background-color: ${p => p.theme.backgroundSecondary};
    border-right-width: 0;
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

const Text = styled('span')`
  padding: 0;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

export default ModuleTable;
