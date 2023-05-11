import {memo, useCallback, useRef} from 'react';
import {CellMeasurerCache} from 'react-virtualized';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

import Category from './category';
import {Data} from './data';
import Level from './level';
import Time from './time';
import Type from './type';

type Props = {
  breadcrumb: Crumb;
  cache: CellMeasurerCache;
  displayRelativeTime: boolean;
  event: Event;
  index: number;
  isLastItem: boolean;
  onResize: () => void;
  organization: Organization;
  relativeTime: string;
  scrollbarSize: number;
  searchTerm: string;
  style: React.CSSProperties;
  meta?: Record<any, any>;
};

export const Breadcrumb = memo(function Breadcrumb({
  index,
  organization,
  event,
  breadcrumb,
  relativeTime,
  displayRelativeTime,
  searchTerm,
  onResize,
  scrollbarSize,
  meta,
  isLastItem,
  cache,
}: Props) {
  const sizingRef = useRef<HTMLDivElement | null>(null);
  const {type, description, color, level, category, timestamp} = breadcrumb;
  const error = breadcrumb.type === BreadcrumbType.ERROR;

  const resizeObserverOnResize = useCallback(() => {
    const height = sizingRef.current?.offsetHeight ?? 0;

    // Values in cache are sometimes slightly off
    // This fuzzy check prevents overly aggressive height recalcs
    if (Math.abs(cache.getHeight(index, 0) - height) > 1) {
      onResize();
    }
  }, [cache, index, onResize]);

  useResizeObserver({
    ref: sizingRef,
    onResize: resizeObserverOnResize,
  });

  return (
    <Wrapper
      ref={sizingRef}
      error={error}
      data-test-id={isLastItem ? 'last-crumb' : 'crumb'}
      scrollbarSize={scrollbarSize}
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
      />
      <div>
        <Level level={level} searchTerm={searchTerm} />
      </div>
      <Time
        timestamp={timestamp}
        relativeTime={relativeTime}
        displayRelativeTime={displayRelativeTime}
        searchTerm={searchTerm}
      />
    </Wrapper>
  );
});

const Wrapper = styled('div')<{
  error: boolean;
  isLastItem: boolean;
  scrollbarSize: number;
}>`
  display: grid;
  grid-template-columns: 64px 140px 1fr 106px 100px ${p => p.scrollbarSize}px;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, auto);
    grid-template-columns: max-content 1fr 74px 82px ${p => p.scrollbarSize}px;

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
