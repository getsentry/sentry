import type {ReactNode} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
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
import {t} from 'sentry/locale';

interface AnnotationsPanelProps {
  items: readonly AnnotationItem[];
  kinds: readonly AnnotationKind[];
}

export function AnnotationsPanel({items, kinds}: AnnotationsPanelProps) {
  const activityItems = items.filter(item => !isSevere(item));
  const severeItems = items.filter(isSevere);
  const activityKinds = ANNOTATION_KINDS.filter(kind => kinds.includes(kind));

  return (
    <Stack flex="1">
      <Stack gap="2xl" padding="2xl">
        {activityKinds.length > 0 ? (
          activityKinds.map(kind => (
            <AnnotationsSection
              key={kind}
              title={ANNOTATION_KIND_LABELS[kind]}
              count={activityItems.filter(item => item.kind === kind).length}
            >
              <Text variant="muted">{t('Table coming soon')}</Text>
            </AnnotationsSection>
          ))
        ) : (
          <Text variant="muted">{t('No annotations in this time range')}</Text>
        )}
      </Stack>
      <Separator orientation="horizontal" border="primary" />
      <Stack padding="2xl">
        <AnnotationsSection title={t('Severe')} count={severeItems.length}>
          <Text variant="muted">
            {severeItems.length > 0
              ? t('Table coming soon')
              : t('No severe annotations in this time range')}
          </Text>
        </AnnotationsSection>
      </Stack>
    </Stack>
  );
}

interface AnnotationsSectionProps {
  children: ReactNode;
  count: number;
  title: string;
}

function AnnotationsSection({title, count, children}: AnnotationsSectionProps) {
  return (
    <Stack as="section" aria-label={title} gap="md">
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
