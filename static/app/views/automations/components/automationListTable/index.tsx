import {useCallback, useMemo, useState, type ComponentProps} from 'react';
import styled from '@emotion/styled';
import {parseAsString, useQueryState} from 'nuqs';

import NoAlertsImage from 'sentry-images/features/alerts-not-found.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {getNextSort} from 'sentry/components/tables/getNextSort';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {SelectAllHeaderCheckbox} from 'sentry/components/workflowEngine/ui/selectAllHeaderCheckbox';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  AutomationsTableActions,
  AutomationsTableActionsBanner,
} from 'sentry/views/automations/components/automationListTable/actions';
import {
  AutomationListRow,
  AutomationListRowSkeleton,
} from 'sentry/views/automations/components/automationListTable/row';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {useCanEditAutomation} from 'sentry/views/automations/hooks/useCanEditAutomation';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

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
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    const nextSort = getNextSort(sortKey, sort ?? undefined, 'asc');
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        sort: encodeSort(nextSort),
        cursor: undefined,
      },
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

export function AutomationListTable({
  automations,
  isPending,
  isError,
  isSuccess,
  sort,
  queryCount,
  allResultsVisible,
}: AutomationListTableProps) {
  const organization = useOrganization();
  const canEditAutomations = useCanEditAutomation();
  const [query] = useQueryState('query', parseAsString);
  const [selected, setSelectedIds] = useState(new Set<string>());
  const [allInQuerySelected, setAllInQuerySelected] = useState(false);

  // Selecting every match only holds while something is selected, so emptying the
  // selection has to clear it too.
  const setSelected = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
    if (ids.size === 0) {
      setAllInQuerySelected(false);
    }
  }, []);

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
    [selected, setSelected]
  );

  return (
    <AutomationsSimpleTable
      header={
        canEditAutomations && selected.size === 0 ? (
          <SimpleTable.HeaderRow key="header">
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
          </SimpleTable.HeaderRow>
        ) : (
          <AutomationsTableActions
            key="actions"
            selected={selected}
            pageSelected={pageSelected}
            togglePageSelected={togglePageSelected}
            queryCount={queryCount}
            allInQuerySelected={allInQuerySelected}
            setAllInQuerySelected={setAllInQuerySelected}
            canEnable={canEnable}
            canDisable={canDisable}
          />
        )
      }
    >
      {selected.size > 0 && (
        <AutomationsTableActionsBanner
          selected={selected}
          pageSelected={pageSelected}
          allResultsVisible={allResultsVisible}
          queryCount={queryCount}
          allInQuerySelected={allInQuerySelected}
          setAllInQuerySelected={setAllInQuerySelected}
        />
      )}
      {isSuccess && automations.length === 0 && (
        <SimpleTable.Empty>
          <StyledFlex gap="xl" direction="column" align="center">
            <img src={NoAlertsImage} />
            <Heading as="h3">{t('No alerts found.')}</Heading>
            <Text align="center" variant="muted">
              {t('Try out that same query on the Monitors page.')}
            </Text>

            <LinkButton
              icon={<IconSearch />}
              variant="primary"
              to={{
                pathname: makeMonitorBasePathname(organization.slug),
                query: {query},
              }}
            >
              {t('Search Monitors')}
            </LinkButton>
          </StyledFlex>
        </SimpleTable.Empty>
      )}
      {isError && <SimpleTable.Error message={t('Error loading alerts')} />}
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

const StyledFlex = styled(Flex)`
  padding: ${p => p.theme.size.sm};
`;

const AutomationsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  margin-bottom: ${p => p.theme.space.xl};

  [data-column-name='last-triggered'],
  [data-column-name='action'],
  [data-column-name='projects'],
  [data-column-name='connected-monitors'] {
    display: none;
  }

  @container (min-width: ${p => p.theme.container.sm}) {
    grid-template-columns: 2.5fr 1fr;

    [data-column-name='projects'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.container.xl}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    [data-column-name='action'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.container['3xl']}) {
    grid-template-columns: 2.5fr minmax(160px, 1fr) 1fr 1fr;

    [data-column-name='last-triggered'] {
      display: flex;
    }
  }

  @container (min-width: ${p => p.theme.container['4xl']}) {
    grid-template-columns: minmax(0, 3fr) minmax(160px, 1fr) 1fr 1fr 1fr;

    [data-column-name='connected-monitors'] {
      display: flex;
    }
  }
`;
