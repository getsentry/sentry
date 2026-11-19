import {Fragment, useState, type ReactNode} from 'react';
import {ClassNames} from '@emotion/react';
import {parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Badge} from '@sentry/scraps/badge';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import type {
  AnnotationItem,
  AnnotationKind,
} from 'sentry/components/charts/annotations/types';
import {useAnnotationFlagLog} from 'sentry/components/charts/annotations/useAnnotationFlagLog';
import {DroppedDataPanel} from 'sentry/components/droppedData/drawer/droppedDataPanel';
import {
  droppedAndFilteredLabel,
  droppedDataLabel,
  formatDroppedShare,
} from 'sentry/components/droppedData/outcomes';
import {
  unexpectedDroppedShare,
  type AskSeerHandler,
  type DroppedDataScope,
} from 'sentry/components/droppedData/outcomeSections';
import {
  useDroppedData,
  type UseDroppedDataParams,
} from 'sentry/components/droppedData/useDroppedData';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

const CHART_CONTEXT_TABS = ['dropped-data', 'releases', 'flags'] as const;

export type ChartContextTab = (typeof CHART_CONTEXT_TABS)[number];

export const CHART_CONTEXT_TAB_PARSERS = {
  contextTab: parseAsStringLiteral(CHART_CONTEXT_TABS),
};

const ANNOTATION_KIND_TABS: Array<[AnnotationKind, ChartContextTab]> = [
  ['release', 'releases'],
  ['flag', 'flags'],
];

export function annotationContextTab(
  items: readonly AnnotationItem[]
): ChartContextTab | undefined {
  return ANNOTATION_KIND_TABS.find(([kind]) =>
    items.some(item => item.kind === kind)
  )?.[1];
}

interface ChartContextDrawerProps extends UseDroppedDataParams {
  source: DroppedDataAnalyticsSource;
  onAskSeer?: AskSeerHandler;
  showAnnotationTabs?: boolean;
}

export function ChartContextDrawer({
  dataset,
  interval,
  projects,
  source,
  onAskSeer,
  showAnnotationTabs = false,
}: ChartContextDrawerProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [scope, setScope] = useState<DroppedDataScope>('unexpected');
  const [{contextTab}, setTabQuery] = useQueryStates(CHART_CONTEXT_TAB_PARSERS);
  const tab = showAnnotationTabs ? (contextTab ?? 'dropped-data') : 'dropped-data';

  const {droppedEvents, acceptedEvents} = useDroppedData({dataset, interval, projects});
  const {releases} = useReleaseStats(selection, {enabled: showAnnotationTabs});
  const {data: flagLog} = useAnnotationFlagLog({enabled: showAnnotationTabs});

  const scopeControl =
    tab === 'dropped-data' ? (
      <SegmentedControl
        aria-label={t('Filter dropped events')}
        size="xs"
        value={scope}
        onChange={nextScope => {
          setScope(nextScope);
          trackAnalytics('explore.dropped_data.scope_toggled', {
            organization,
            dataset,
            source,
            scope: nextScope,
          });
        }}
      >
        <SegmentedControl.Item key="unexpected">{t('Unexpected')}</SegmentedControl.Item>
        <SegmentedControl.Item key="all">{t('All')}</SegmentedControl.Item>
      </SegmentedControl>
    ) : null;

  const droppedDataPanel = (
    <DroppedDataPanel
      dataset={dataset}
      interval={interval}
      projects={projects}
      scope={scope}
      source={source}
      onAskSeer={onAskSeer}
      onScopeChange={setScope}
    />
  );

  const tabs: ChartContextTabItem[] = [
    {
      key: 'dropped-data',
      label: droppedDataLabel(dataset),
      badge:
        defined(droppedEvents) && defined(acceptedEvents)
          ? formatDroppedShare(unexpectedDroppedShare(droppedEvents, acceptedEvents))
          : undefined,
    },
    {key: 'releases', label: t('Releases'), badge: releases?.length},
    {key: 'flags', label: t('Flags'), badge: flagLog?.length},
  ];

  return (
    <Stack minHeight="100%">
      {showAnnotationTabs ? (
        <Tabs
          value={tab}
          onChange={nextTab => {
            void setTabQuery(
              {contextTab: nextTab === 'dropped-data' ? null : nextTab},
              {history: 'replace'}
            );
            trackAnalytics('explore.chart_context.tab_selected', {
              organization,
              dataset,
              source,
              tab: nextTab,
            });
          }}
          size="sm"
        >
          {({TabList, TabPanels}) => (
            <ChartContextDrawerLayout
              title={
                <TabList aria-label={t('Chart context')} variant="floating">
                  {tabs.map(({key, label, badge}) => (
                    <TabList.Item key={key} textValue={label}>
                      <Flex align="center" gap="xs">
                        {label}
                        {defined(badge) && <Badge variant="muted">{badge}</Badge>}
                      </Flex>
                    </TabList.Item>
                  ))}
                </TabList>
              }
              actions={scopeControl}
            >
              <ClassNames>
                {({css}) => (
                  <TabPanels
                    className={css`
                      display: flex;
                      flex-direction: column;
                      flex-grow: 1;
                      padding-top: 0;
                    `}
                  >
                    <TabPanels.Item key="dropped-data">{droppedDataPanel}</TabPanels.Item>
                    <TabPanels.Item key="releases">
                      <TableComingSoon />
                    </TabPanels.Item>
                    <TabPanels.Item key="flags">
                      <TableComingSoon />
                    </TabPanels.Item>
                  </TabPanels>
                )}
              </ClassNames>
            </ChartContextDrawerLayout>
          )}
        </Tabs>
      ) : (
        <ChartContextDrawerLayout
          title={<Text size="md">{droppedAndFilteredLabel(dataset)}</Text>}
          actions={scopeControl}
        >
          {droppedDataPanel}
        </ChartContextDrawerLayout>
      )}
    </Stack>
  );
}

interface ChartContextTabItem {
  badge: string | number | undefined;
  key: ChartContextTab;
  label: string;
}

interface ChartContextDrawerLayoutProps {
  actions: ReactNode;
  children: ReactNode;
  title: ReactNode;
}

function ChartContextDrawerLayout({
  title,
  actions,
  children,
}: ChartContextDrawerLayoutProps) {
  return (
    <Fragment>
      <DrawerHeader>
        <Flex flex="1" align="center" justify="between" gap="md" paddingRight="lg">
          {title}
          {actions}
        </Flex>
      </DrawerHeader>
      <Stack flex="1" padding="0">
        {props => <DrawerBody {...props}>{children}</DrawerBody>}
      </Stack>
    </Fragment>
  );
}

function TableComingSoon() {
  return (
    <Container padding="xl 2xl">
      <Text variant="muted">{t('Table coming soon')}</Text>
    </Container>
  );
}
