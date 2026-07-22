import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {IconChevron, IconGrid, IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';

import {DEFAULT_STATS_PERIOD, PERIOD_FILTER_OPTIONS} from './periods';
import type {OverviewView, SortValue} from './types';

const SORT_OPTIONS: Array<{label: string; value: SortValue}> = [
  {value: 'activity', label: t('Recent activity')},
  {value: 'events', label: t('Most events')},
];

export function OverviewFilters({
  allCollapsed,
  onToggleAll,
  onUpdateQuery,
  onViewChange,
  period,
  sort,
  view,
}: {
  allCollapsed: boolean;
  onToggleAll: () => void;
  onUpdateQuery: (patch: Record<string, string | string[] | undefined>) => void;
  onViewChange: (view: OverviewView) => void;
  period: string;
  sort: SortValue;
  view: OverviewView;
}) {
  return (
    <Flex justify="between" align="center" gap="md" wrap="wrap">
      <Flex gap="md" align="center" wrap="wrap">
        <PageFilterBar condensed>
          <ProjectPageFilter />
        </PageFilterBar>
        <CompactSelect
          value={period}
          options={PERIOD_FILTER_OPTIONS}
          onChange={selected =>
            onUpdateQuery({
              period:
                selected.value === DEFAULT_STATS_PERIOD
                  ? undefined
                  : String(selected.value),
            })
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Activity')} />
          )}
        />
        <CompactSelect
          value={sort}
          options={SORT_OPTIONS}
          onChange={selected =>
            onUpdateQuery({
              // Default sort keeps the URL clean.
              sort: selected.value === 'activity' ? undefined : String(selected.value),
            })
          }
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} size="sm" prefix={t('Sort')} />
          )}
        />
      </Flex>
      <Flex gap="xl" align="center">
        <Button
          size="xs"
          variant="link"
          icon={
            <IconChevron isDouble direction={allCollapsed ? 'down' : 'up'} size="xs" />
          }
          onClick={onToggleAll}
        >
          {allCollapsed ? t('Expand all') : t('Collapse all')}
        </Button>
        <SegmentedControl<OverviewView>
          size="xs"
          value={view}
          onChange={onViewChange}
          aria-label={t('View mode')}
        >
          <SegmentedControl.Item
            key="cards"
            icon={<IconGrid />}
            aria-label={t('Card view')}
            tooltip={t('Card view')}
          />
          <SegmentedControl.Item
            key="table"
            icon={<IconTable />}
            aria-label={t('Table view')}
            tooltip={t('Table view')}
          />
        </SegmentedControl>
      </Flex>
    </Flex>
  );
}
