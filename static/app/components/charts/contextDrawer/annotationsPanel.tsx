import {useEffect, useRef, type ReactNode, type Ref} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {
  ANNOTATION_KIND_LABELS,
  ANNOTATION_KINDS,
} from 'sentry/components/charts/annotations/kinds';
import {isSevere} from 'sentry/components/charts/annotations/severity';
import type {
  AnnotationItem,
  AnnotationKind,
} from 'sentry/components/charts/annotations/types';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {ReleasesDrawerTable} from 'sentry/views/explore/releases/drawer/releasesDrawerTable';

import type {ChartContextSection} from './chartContextDrawer';

interface AnnotationsPanelProps {
  items: readonly AnnotationItem[];
  kinds: readonly AnnotationKind[];
  section?: ChartContextSection | null;
}

export function AnnotationsPanel({items, kinds, section}: AnnotationsPanelProps) {
  const {selection} = usePageFilters();
  const activityRef = useRef<HTMLElement>(null);
  const severeRef = useRef<HTMLElement>(null);
  const activityItems = items.filter(item => !isSevere(item));
  const severeItems = items.filter(isSevere);
  const activityKinds = ANNOTATION_KINDS.filter(kind => kinds.includes(kind));

  useEffect(() => {
    const sectionRefs = {activity: activityRef, severe: severeRef};
    if (section) {
      sectionRefs[section].current?.scrollIntoView({block: 'start'});
    }
  }, [section]);

  return (
    <Stack flex="1">
      <AnnotationsSection
        ref={severeRef}
        title={t('Severe')}
        count={severeItems.length}
        padding="2xl"
      >
        <Text variant="muted">
          {severeItems.length > 0
            ? t('Table coming soon')
            : t('No severe annotations in this time range')}
        </Text>
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
          activityKinds.map(kind => (
            <AnnotationsSection
              key={kind}
              title={ANNOTATION_KIND_LABELS[kind]}
              count={activityItems.filter(item => item.kind === kind).length}
            >
              {kind === 'release' ? (
                <ReleasesDrawerTable
                  {...selection}
                  releaseDrawerSource="chart-context-drawer"
                />
              ) : (
                <Text variant="muted">{t('Table coming soon')}</Text>
              )}
            </AnnotationsSection>
          ))
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
