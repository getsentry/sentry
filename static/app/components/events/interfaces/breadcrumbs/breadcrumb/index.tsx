import {useEffect, useRef} from 'react';
import {CellMeasurerCache, List} from 'react-virtualized';
import styled from '@emotion/styled';

import type {BreadcrumbTransactionEvent} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

import Category from './category';
import {Data} from './data';
import Level from './level';
import Time from './time';
import Type from './type';

export interface BreadcrumbProps {
  breadcrumb: Crumb;
  cache: CellMeasurerCache;
  displayRelativeTime: boolean;
  event: Event;
  index: number;
  isLastItem: boolean;
  organization: Organization;
  parent: List;
  relativeTime: string;
  searchTerm: string;
  style: React.CSSProperties;
  transactionEvents: BreadcrumbTransactionEvent[] | undefined;
  meta?: Record<any, any>;
}

export function Breadcrumb({
  organization,
  event,
  breadcrumb,
  relativeTime,
  displayRelativeTime,
  searchTerm,
  meta,
  isLastItem,
  index,
  cache,
  parent,
  transactionEvents,
}: BreadcrumbProps) {
  const {type, description, color, level, category, timestamp} = breadcrumb;
  const error = breadcrumb.type === BreadcrumbType.ERROR;

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) {
      return undefined;
    }
    if (window.ResizeObserver === undefined) {
      return undefined;
    }

    const onResizeObserver: ResizeObserverCallback = entries => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const height =
        entry.contentBoxSize?.[0]?.blockSize ?? entry.borderBoxSize?.[0]?.blockSize ?? 0;

      if (height === 0) {
        return;
      }

      const oldHeight = cache.getHeight(index, 0);

      if (Math.abs(oldHeight - height) > 1) {
        cache.set(index, 0, cache.getWidth(index, 0), height);
        // pass row and column index so that react virtualized can only update the
        // cells after the one that has changed and avoid recomputing the entire grid
        parent.recomputeGridSize({rowIndex: index, columnIndex: 0});
      }
    };

    const observer = new ResizeObserver(onResizeObserver);
    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, [cache, index, parent]);

  return (
    <Wrapper
      ref={wrapperRef}
      error={error}
      data-test-id={isLastItem ? 'last-crumb' : 'crumb'}
      isLastItem={isLastItem}
    >
      <Type type={type} color={color} description={description} error={error} />
      <Category category={category} searchTerm={searchTerm} />
      <Data
        event={event}
        organization={organization}
        breadcrumb={breadcrumb}
        searchTerm={searchTerm}
        meta={meta}
        transactionEvents={transactionEvents}
      />
      <Level level={level} searchTerm={searchTerm} />
      <Time
        timestamp={timestamp}
        relativeTime={relativeTime}
        displayRelativeTime={displayRelativeTime}
        searchTerm={searchTerm}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')<{
  error: boolean;
  isLastItem: boolean;
}>`
  display: grid;
  grid-template-columns: 64px 140px 1fr 106px 100px;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, auto);
    grid-template-columns: max-content 1fr 74px 82px;

    > * {
      padding: ${space(1)};

      /* Type */
      :nth-child(5n-4) {
        grid-row: 1/-1;
        padding-right: 0;
        padding-left: 0;
        margin-left: ${space(2)};
        margin-right: ${space(1)};
      }

      /* Data */
      :nth-child(5n-2) {
        grid-row: 2/2;
        grid-column: 2/-1;
        padding-top: 0;
        padding-right: ${space(2)};
      }

      /* Level */
      :nth-child(5n-1) {
        padding-right: 0;
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
      }

      /* Time */
      :nth-child(5n) {
        padding: ${space(1)} ${space(2)};
      }
    }
  }

  word-break: break-all;
  white-space: pre-wrap;
`;
