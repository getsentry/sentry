import {useCallback, useMemo, useState, type ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {hasEveryAccess} from 'sentry/components/acl/access';
import LoadingError from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationsTableActions} from 'sentry/views/automations/components/automationListTable/actions';
import {
  AutomationListRow,
  AutomationListRowSkeleton,
} from 'sentry/views/automations/components/automationListTable/row';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';

type AutomationListTableProps = {
  allResultsVisible: boolean;
  automations: Automation[];
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
  queryCount: string;
  sort: Sort | undefined;
};

function LoadingSkeletons() {
  return Array.from({length: AUTOMATION_LIST_PAGE_LIMIT}).map((_, index) => (
    <AutomationListRowSkeleton key={index} />
  ));
}

function HeaderCell({
  children,
  sortKey,
  sort,
  ...props
}: {
  children: React.ReactNode;
  sort: Sort | undefined;
  className?: string;
  divider?: boolean;
  sortKey?: string;
} & Omit<ComponentProps<typeof SimpleTable.HeaderCell>, 'sort'>) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSortedByField = sort?.field === sortKey;
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    const newSort =
      sort && isSortedByField ? `${sort.kind === 'asc' ? '-' : ''}${sortKey}` : sortKey;
    navigate({
      pathname: location.pathname,
      query: {...location.query, sort: newSort, cursor: undefined},
    });
  };

  return (
    <SimpleTable.HeaderCell
      {...props}
      sort={sort && sortKey === sort?.field ? sort.kind : undefined}
      handleSortClick={sortKey ? handleSort : undefined}
    >
      {children}
    </SimpleTable.HeaderCell>
  );
}

function AutomationListTable({
  automations,
  isPending,
  isError,
  isSuccess,
  sort,
  queryCount,
  allResultsVisible,
}: AutomationListTableProps) {
  const organization = useOrganization();
  const canEditAutomations = hasEveryAccess(['alerts:write'], {organization});

  const [selected, setSelected] = useState(new Set<string>());

  const togglePageSelected = (pageSelected: boolean) => {
    const newSelected = new Set<string>();
    if (pageSelected) {
      automations.forEach(automation => newSelected.add(automation.id));
    }
    setSelected(newSelected);
  };
  const automationIds = new Set(automations.map(a => a.id));
  const pageSelected =
    !isPending &&
    automationIds.size !== 0 &&
    automationIds.difference(selected).size === 0;
  const anySelected = selected.size > 0;

  const canEnable = useMemo(
    () =>
      automations.some(automation => selected.has(automation.id) && !automation.enabled),
    [automations, selected]
  );
  const canDisable = useMemo(
    () =>
      automations.some(automation => selected.has(automation.id) && automation.enabled),
    [automations, selected]
  );

  const handleSelect = useCallback(
    (id: string) => {
      const newSelected = new Set(selected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelected(newSelected);
    },
    [selected]
  );

  return (
    <AutomationsSimpleTable>
      {canEditAutomations && selected.size === 0 ? (
        <SimpleTable.Header key="header">
          <HeaderCell sort={sort} sortKey="name">
            <Flex gap="md" align="center">
              <SelectAllHeaderCheckbox
                checked={pageSelected || (anySelected ? 'indeterminate' : false)}
                onChange={checked => togglePageSelected(checked)}
              />
              <span>{t('Name')}</span>
            </Flex>
          </HeaderCell>
          <HeaderCell
            data-column-name="last-triggered"
            sort={sort}
            sortKey="lastTriggered"
          >
            {t('Last Triggered')}
          </HeaderCell>
          <HeaderCell data-column-name="action" sort={sort} sortKey="actions">
            {t('Actions')}
          </HeaderCell>
          <HeaderCell data-column-name="projects" sort={sort}>
            {t('Projects')}
          </HeaderCell>
          <HeaderCell
            data-column-name="connected-monitors"
            sort={sort}
            sortKey="connectedDetectors"
          >
            {t('Monitors')}
          </HeaderCell>
        </SimpleTable.Header>
      ) : (
        <AutomationsTableActions
          key="actions"
          selected={selected}
          pageSelected={pageSelected}
          togglePageSelected={togglePageSelected}
          queryCount={queryCount}
          allResultsVisible={allResultsVisible}
          canEnable={canEnable}
          canDisable={canDisable}
        />
      )}
      {isSuccess && automations.length === 0 && (
        <SimpleTable.Empty>{t('No alerts found')}</SimpleTable.Empty>
      )}
      {isError && <LoadingError message={t('Error loading alerts')} />}
      {isPending && <LoadingSkeletons />}
      {isSuccess &&
        automations.map(automation => (
          <AutomationListRow
            key={automation.id}
            automation={automation}
            selected={selected.has(automation.id)}
            onSelect={handleSelect}
          />
        ))}
    </AutomationsSimpleTable>
  );
}

const AutomationsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  margin-bottom: ${space(2)};

  [data-column-name='last-triggered'],
  [data-column-name='action'],
  [data-column-name='projects'],
  [data-column-name='connected-monitors'] {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 2.5fr 1fr;

    [data-column-name='projects'] {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    [data-column-name='action'] {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 2.5fr minmax(160px, 1fr) 1fr 1fr;

    [data-column-name='last-triggered'] {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 3fr) minmax(160px, 1fr) 1fr 1fr 1fr;

    [data-column-name='connected-monitors'] {
      display: flex;
    }
  }
`;

export default AutomationListTable;
