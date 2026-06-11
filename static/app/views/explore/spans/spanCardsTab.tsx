import {Fragment} from 'react';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {SpanCardPanel} from 'sentry/views/explore/spans/spanCardPanel';
import {
  MAX_SPAN_CARDS,
  type SpanCard,
  useAddSpanCard,
  useSpanCards,
} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {useSortableSpanCards} from 'sentry/views/explore/spans/useSortableSpanCards';

// eslint-disable-next-line boundaries/dependencies
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

interface SpanCardsTabContentProps {
  datePageFilterProps: DatePageFilterProps;
}

export function SpanCardsTabContent({datePageFilterProps}: SpanCardsTabContentProps) {
  return (
    <Fragment>
      <SpanCardsFilterSection datePageFilterProps={datePageFilterProps} />
      <ExploreBodyContent>
        <ExploreContentSection gap="md">
          <QuotaExceededAlert referrer="spans-explore" traceItemDataset="spans" />
          <SortableSpanCards />
        </ExploreContentSection>
      </ExploreBodyContent>
    </Fragment>
  );
}

function SpanCardsFilterSection({datePageFilterProps}: SpanCardsTabContentProps) {
  const cards = useSpanCards();
  const addCard = useAddSpanCard();
  const isAddDisabled = cards.length >= MAX_SPAN_CARDS;

  return (
    <ExploreBodySearch>
      <Layout.Main width="full">
        <Flex justify="between" align="center" gap="md" wrap="wrap">
          <PageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter {...datePageFilterProps} />
          </PageFilterBar>
          <Flex gap="sm" align="center" wrap="wrap">
            <Button disabled>{t('Save as')}</Button>
            <Button
              icon={<IconAdd />}
              onClick={() => addCard('aggregate')}
              disabled={isAddDisabled}
            >
              {t('Add Span Card')}
            </Button>
            <Button
              icon={<IconAdd />}
              onClick={() => addCard('equation')}
              disabled={isAddDisabled}
            >
              {t('Add Equation Card')}
            </Button>
          </Flex>
        </Flex>
      </Layout.Main>
    </ExploreBodySearch>
  );
}

function SortableSpanCards() {
  const {sortableItems, sensors, onDragStart, onDragEnd, onDragCancel, isDragging} =
    useSortableSpanCards();

  return (
    <WidgetSyncContextProvider groupName="span-card-charts">
      <Stack gap="md">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            {sortableItems.map(({id, card}) => (
              <SortableSpanCardPanel
                key={id}
                sortableId={id}
                card={card}
                isAnyDragging={isDragging}
                canDrag={sortableItems.length > 1}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Stack>
    </WidgetSyncContextProvider>
  );
}

interface SortableSpanCardPanelProps {
  canDrag: boolean;
  card: SpanCard;
  isAnyDragging: boolean;
  sortableId: string;
}

function SortableSpanCardPanel({
  sortableId,
  card,
  isAnyDragging,
  canDrag,
}: SortableSpanCardPanelProps) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useSortable({
    id: sortableId,
    transition: null,
  });

  return (
    <SpanCardPanel
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
      }}
      card={card}
      dragListeners={canDrag ? listeners : undefined}
      dragAttributes={attributes}
      isAnyDragging={isAnyDragging}
      isDragging={isDragging}
    />
  );
}
