import {Fragment, useState, type ReactNode} from 'react';
import {parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Badge} from '@sentry/scraps/badge';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import type {AnnotationKind} from 'sentry/components/charts/annotations/types';
import {useAnnotationItems} from 'sentry/components/charts/annotations/useAnnotationItems';
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
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DroppedDataAnalyticsSource} from 'sentry/utils/analytics/exploreAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AnnotationsPanel} from './annotationsPanel';

const CHART_CONTEXT_TABS = ['dropped-data', 'annotations'] as const;
const CHART_CONTEXT_SECTIONS = ['activity', 'pinned'] as const;

type ChartContextTab = (typeof CHART_CONTEXT_TABS)[number];
export type ChartContextSection = (typeof CHART_CONTEXT_SECTIONS)[number];

export interface ChartContextDrawerTarget {
  section?: ChartContextSection;
  tab?: ChartContextTab;
}

export const CHART_CONTEXT_TAB_PARSERS = {
  contextTab: parseAsStringLiteral(CHART_CONTEXT_TABS),
  contextSection: parseAsStringLiteral(CHART_CONTEXT_SECTIONS),
};

interface ChartContextDrawerProps extends UseDroppedDataParams {
  source: DroppedDataAnalyticsSource;
  annotationKinds?: readonly AnnotationKind[];
  onAskSeer?: AskSeerHandler;
  showAnnotationTabs?: boolean;
}

export function ChartContextDrawer({
  dataset,
  interval,
  projects,
  source,
  annotationKinds = [],
  onAskSeer,
  showAnnotationTabs = false,
}: ChartContextDrawerProps) {
  const organization = useOrganization();
  const [scope, setScope] = useState<DroppedDataScope>('unexpected');
  const [{contextTab, contextSection}, setTabQuery] = useQueryStates(
    CHART_CONTEXT_TAB_PARSERS
  );
  const hasDroppedDataTab = organization.features.includes(
    'explore-data-fidelity-annotations'
  );
  const defaultTab: ChartContextTab = hasDroppedDataTab ? 'dropped-data' : 'annotations';
  const shownContextTab =
    contextTab === 'dropped-data' && !hasDroppedDataTab ? null : contextTab;
  const tab = showAnnotationTabs ? (shownContextTab ?? defaultTab) : 'dropped-data';

  const {droppedEvents, acceptedEvents} = useDroppedData({dataset, interval, projects});
  const itemsByKind = useAnnotationItems({
    dataset,
    interval,
    enabled: showAnnotationTabs,
  });
  const annotationItems = annotationKinds.flatMap(kind => itemsByKind[kind] ?? []);

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
    ...(hasDroppedDataTab
      ? [
          {
            key: 'dropped-data' as const,
            label: droppedDataLabel(dataset),
            badge:
              defined(droppedEvents) && defined(acceptedEvents)
                ? formatDroppedShare(
                    unexpectedDroppedShare(droppedEvents, acceptedEvents)
                  )
                : undefined,
            panel: droppedDataPanel,
          },
        ]
      : []),
    {
      key: 'annotations',
      label: t('Annotations'),
      badge: annotationItems.length,
      panel: (
        <AnnotationsPanel
          items={annotationItems}
          kinds={annotationKinds}
          section={contextSection}
        />
      ),
    },
  ];

  return (
    <Stack minHeight="100%">
      {showAnnotationTabs ? (
        <Tabs
          value={tab}
          onChange={nextTab => {
            void setTabQuery(
              {contextTab: nextTab === defaultTab ? null : nextTab, contextSection: null},
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
          {({TabList}) => (
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
              {tabs.find(({key}) => key === tab)?.panel}
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
  panel: ReactNode;
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
