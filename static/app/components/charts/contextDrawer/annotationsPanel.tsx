import {lazy, useEffect, useRef, type ReactNode, type Ref} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {
  ANNOTATION_KIND_LABELS,
  ANNOTATION_KINDS,
} from 'sentry/components/charts/annotations/kinds';
import type {
  AnnotationItem,
  AnnotationKind,
} from 'sentry/components/charts/annotations/types';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';

import {AnnotationFlagsTable} from './annotationFlagsTable';
import {AnnotationPinnedTable} from './annotationPinnedTable';
import type {ChartContextSection} from './chartContextDrawer';

export const ANNOTATION_FLAGS_PAGE = 'contextFlagsPage';

const LazyReleasesDrawerTable = lazy(() =>
  import('sentry/views/explore/releases/drawer/releasesDrawerTable').then(module => ({
    default: module.ReleasesDrawerTable,
  }))
);

interface AnnotationsPanelProps {
  items: readonly AnnotationItem[];
  kinds: readonly AnnotationKind[];
  section?: ChartContextSection | null;
}

export function AnnotationsPanel({items, kinds, section}: AnnotationsPanelProps) {
  const {selection} = usePageFilters();
  const activityRef = useRef<HTMLElement>(null);
  const pinnedRef = useRef<HTMLElement>(null);
  const activityItems = items.filter(item => !item.pinned);
  const pinnedItems = items.filter(item => item.pinned);
  const activityKinds = ANNOTATION_KINDS.filter(kind => kinds.includes(kind));

  useEffect(() => {
    const sectionRefs = {activity: activityRef, pinned: pinnedRef};
    if (section) {
      sectionRefs[section].current?.scrollIntoView({block: 'start'});
    }
  }, [section]);

  return (
    <Stack flex="1">
      <AnnotationsSection
        ref={pinnedRef}
        title={t('Pinned')}
        count={pinnedItems.length}
        padding="2xl"
      >
        {pinnedItems.length > 0 ? (
          <AnnotationPinnedTable items={pinnedItems} />
        ) : (
          <Text variant="muted">{t('No pinned annotations in this time range')}</Text>
        )}
      </AnnotationsSection>
      <Separator orientation="horizontal" border="primary" />
      <Stack
        ref={activityRef}
        as="section"
        aria-label={t('Activity')}
        gap="2xl"
        padding="2xl"
      >
        {activityKinds.length > 0 ? (
          activityKinds.map(kind => {
            const kindItems = activityItems.filter(item => item.kind === kind);
            return (
              <AnnotationsSection
                key={kind}
                title={ANNOTATION_KIND_LABELS[kind]}
                count={kindItems.length}
              >
                {kind === 'release' ? (
                  <LazyLoad
                    LazyComponent={LazyReleasesDrawerTable}
                    loadingFallback={<LoadingIndicator mini />}
                    {...selection}
                    releaseDrawerSource="chart-context-drawer"
                  />
                ) : kind === 'flag' ? (
                  <AnnotationFlagsTable
                    items={kindItems}
                    pageKeyName={ANNOTATION_FLAGS_PAGE}
                  />
                ) : (
                  <Text variant="muted">{t('Table coming soon')}</Text>
                )}
              </AnnotationsSection>
            );
          })
        ) : (
          <Text variant="muted">{t('No annotations in this time range')}</Text>
        )}
      </Stack>
    </Stack>
  );
}

interface AnnotationsSectionProps {
  children: ReactNode;
  count: number;
  title: string;
  padding?: StackProps['padding'];
  ref?: Ref<HTMLElement>;
}

function AnnotationsSection({
  title,
  count,
  padding,
  ref,
  children,
}: AnnotationsSectionProps) {
  return (
    <Stack ref={ref} as="section" aria-label={title} gap="md" padding={padding}>
      <Flex align="center" gap="sm">
        <Heading as="h3" size="lg">
          {title}
        </Heading>
        <Badge variant="muted">{count}</Badge>
      </Flex>
      {children}
    </Stack>
  );
}
