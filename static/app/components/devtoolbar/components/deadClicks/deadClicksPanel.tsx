import {useCallback, useRef} from 'react';

import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {
  badgeWithLabelCss,
  listItemGridCss,
  listItemPlaceholderWrapperCss,
} from 'sentry/components/devtoolbar/styles/listItem';
import {smallCss} from 'sentry/components/devtoolbar/styles/typography';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexColumnCss} from '../../styles/reset';
import InfiniteListItems from '../infiniteListItems';
import InfiniteListState from '../infiniteListState';
import PanelLayout from '../panelLayout';

import useInfiniteDeadClicksList from './useInfiniteDeadClicksList';

export default function DeadClicksPanel() {
  const queryResult = useInfiniteDeadClicksList({
    sort: '-count_dead_clicks',
  });

  const estimateSize = 89;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Dead Clicks">
      <div css={resetFlexColumnCss}>
        <InfiniteListState
          queryResult={queryResult}
          backgroundUpdatingMessage={() => null}
          loadingMessage={() => (
            <div
              css={[
                resetFlexColumnCss,
                panelSectionCss,
                panelInsetContentCss,
                listItemPlaceholderWrapperCss,
              ]}
            >
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
            </div>
          )}
        >
          <InfiniteListItems
            estimateSize={() => estimateSize}
            queryResult={queryResult}
            itemRenderer={props => <DeadClickListItem {...props} />}
            emptyMessage={() => <p css={panelInsetContentCss}>No items to show</p>}
          />
        </InfiniteListState>
      </div>
    </PanelLayout>
  );
}

function DeadClickListItem({item}: {item: DeadRageSelectorItem}) {
  const {projectId} = useConfiguration();

  const {onMouseOver, onMouseOut} = useHighlightMouseEvents({
    item,
  });
  return (
    <AnalyticsProvider keyVal="issue-list.item" nameVal="issue list item">
      <div css={listItemGridCss} onMouseOver={onMouseOver} onMouseOut={onMouseOut}>
        <TextOverflow
          css={[badgeWithLabelCss, smallCss, 'display: block']}
          style={{gridArea: 'name'}}
        >
          <SentryAppLink
            to={{
              url: `/issues/`,
              query: {project: projectId},
            }}
          >
            <strong>{item.dom_element.selector ?? '<unknown>'}</strong>
          </SentryAppLink>
        </TextOverflow>

        <div style={{gridArea: 'message'}}>
          <TextOverflow css={[smallCss]}>{item.dom_element.querySelector}</TextOverflow>
        </div>
      </div>
    </AnalyticsProvider>
  );
}

function useHighlightMouseEvents({
  item,
  showAfterMs = 0,
}: {
  item: DeadRageSelectorItem;
  showAfterMs?: number;
}) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>();

  const onMouseOver = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      canvasRef.current = highlightNodes(item.dom_element.querySelector);
    }, showAfterMs);
  }, [item, showAfterMs]);

  const onMouseOut = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    } else {
      canvasRef.current?.remove();
      canvasRef.current = null;
    }
  }, []);

  return {onMouseOver, onMouseOut};
}

function highlightNodes(selector: string) {
  try {
    const found = document.querySelectorAll(selector);
    if (!found.length) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.inset = String(0);
    canvas.style.zIndex = '99999';
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.fillStyle = 'rgba(168, 196, 236, 0.75)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    found.forEach(elementToHighlight => {
      const rect = elementToHighlight.getBoundingClientRect();
      context?.clearRect(rect.x, rect.y, rect.width, rect.height);
    });

    document.body.appendChild(canvas);
    return canvas;
  } catch {
    // `querySelectorAll` can throw if the selector is invalid, which
    // happens because we don't do proper escaping of the attr values yet.
  }
  return null;
}
