import {Component, createContext, createRef} from 'react';

import {
  TOGGLE_BORDER_BOX,
  TOGGLE_BUTTON_MAX_WIDTH,
} from 'sentry/components/performance/waterfall/treeConnector';
import {rectOfContent} from 'sentry/components/performance/waterfall/utils';
import getDisplayName from 'sentry/utils/getDisplayName';
import clamp from 'sentry/utils/number/clamp';
import toPercent from 'sentry/utils/number/toPercent';
import type {UserSelectValues} from 'sentry/utils/userselect';
import {setBodyUserSelect} from 'sentry/utils/userselect';

import type {DragManagerChildrenProps} from './dragManager';
import type {NewTraceDetailsSpanBar} from './newTraceDetailsSpanBar';
import type {SpanBar} from './spanBar';

export type ScrollbarManagerChildrenProps = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  getCurrentLeftPos: () => number;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onScroll: () => void;
  onWheel: (deltaX: number) => void;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  scrollBarAreaRef: React.RefObject<HTMLDivElement>;
  storeSpanBar: (spanBar: SpanBar | NewTraceDetailsSpanBar) => void;
  updateHorizontalScrollState: (avgSpanDepth: number) => void;
  updateScrollState: () => void;
  virtualScrollbarRef: React.RefObject<HTMLDivElement>;
};

const ScrollbarManagerContext = createContext<ScrollbarManagerChildrenProps>({
  addContentSpanBarRef: () => {},
  updateHorizontalScrollState: () => {},
  removeContentSpanBarRef: () => {},
  virtualScrollbarRef: createRef<HTMLDivElement>(),
  scrollBarAreaRef: createRef<HTMLDivElement>(),
  onDragStart: () => {},
  onScroll: () => {},
  onWheel: () => {},
  updateScrollState: () => {},
  storeSpanBar: () => {},
  getCurrentLeftPos: () => 0,
});

const selectRefs = (
  refs: Set<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  transform: (element: HTMLDivElement) => void
) => {
  if (!(refs instanceof Set)) {
    if (refs.current) {
      transform(refs.current);
    }

    return;
  }

  refs.forEach(element => {
    if (document.body.contains(element)) {
      transform(element);
    }
  });
};

// simple linear interpolation between start and end such that needle is between [0, 1]
const lerp = (start: number, end: number, needle: number) => {
  return start + needle * (end - start);
};

type Props = {
  children: React.ReactNode;
  dividerPosition: number;
  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;

  dragProps?: DragManagerChildrenProps;
  isEmbedded?: boolean;
};

type State = {
  maxContentWidth: number | undefined;
};

export class Provider extends Component<Props, State> {
  state: State = {
    maxContentWidth: undefined,
  };

  componentDidMount() {
    // React will guarantee that refs are set before componentDidMount() is called;
    // but only for DOM elements that actually got rendered
    this.initializeScrollState();
  }

  componentDidUpdate(prevProps: Props) {
    // Re-initialize the scroll state whenever:
    // - the window was selected via the minimap or,
    // - the divider was re-positioned.

    const dividerPositionChanged =
      this.props.dividerPosition !== prevProps.dividerPosition;

    const viewWindowChanged =
      prevProps.dragProps &&
      this.props.dragProps &&
      (prevProps.dragProps.viewWindowStart !== this.props.dragProps.viewWindowStart ||
        prevProps.dragProps.viewWindowEnd !== this.props.dragProps.viewWindowEnd);

    if (dividerPositionChanged || viewWindowChanged || this.contentSpanBar.size > 0) {
      this.initializeScrollState();
    }
  }

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  contentSpanBar: Set<HTMLDivElement> = new Set();
  virtualScrollbar: React.RefObject<HTMLDivElement> = createRef<HTMLDivElement>();
  scrollBarArea: React.RefObject<HTMLDivElement> = createRef<HTMLDivElement>();
  isDragging: boolean = false;
  isWheeling: boolean = false;
  wheelTimeout: NodeJS.Timeout | null = null;
  animationTimeout: NodeJS.Timeout | null = null;
  previousUserSelect: UserSelectValues | null = null;
  spanBars: Array<SpanBar | NewTraceDetailsSpanBar> = [];
  currentLeftPos = 0;

  getReferenceSpanBar() {
    for (const currentSpanBar of this.contentSpanBar) {
      const isHidden = currentSpanBar.offsetParent === null;
      if (!document.body.contains(currentSpanBar) || isHidden) {
        continue;
      }
      return currentSpanBar;
    }

    return undefined;
  }

  initializeScrollState = () => {
    if (this.contentSpanBar.size === 0 || !this.hasInteractiveLayer()) {
      return;
    }

    // reset all span bar content containers to their natural widths
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.style.removeProperty('width');
      spanBarDOM.style.removeProperty('max-width');
      spanBarDOM.style.removeProperty('overflow');
      spanBarDOM.style.removeProperty('transform');
    });

    // Find the maximum content width. We set each content spanbar to be this maximum width,
    // such that all content spanbar widths are uniform.
    const maxContentWidth = Array.from(this.contentSpanBar).reduce(
      (currentMaxWidth, currentSpanBar) => {
        const isHidden = currentSpanBar.offsetParent === null;
        if (!document.body.contains(currentSpanBar) || isHidden) {
          return currentMaxWidth;
        }

        const maybeMaxWidth = currentSpanBar.scrollWidth;

        if (maybeMaxWidth > currentMaxWidth) {
          return maybeMaxWidth;
        }

        return currentMaxWidth;
      },
      0
    );

    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.style.width = `${maxContentWidth}px`;
      spanBarDOM.style.maxWidth = `${maxContentWidth}px`;
      spanBarDOM.style.overflow = 'hidden';
    });

    // set inner width of scrollbar area
    selectRefs(this.scrollBarArea, (scrollBarArea: HTMLDivElement) => {
      scrollBarArea.style.width = `${maxContentWidth}px`;
      scrollBarArea.style.maxWidth = `${maxContentWidth}px`;
    });

    selectRefs(
      this.props.interactiveLayerRef,
      (interactiveLayerRefDOM: HTMLDivElement) => {
        interactiveLayerRefDOM.scrollLeft = 0;
      }
    );

    const spanBarDOM = this.getReferenceSpanBar();

    if (spanBarDOM) {
      this.syncVirtualScrollbar(spanBarDOM);
    }
  };

  getCurrentLeftPos = () => this.currentLeftPos;

  updateHorizontalScrollState = (avgSpanDepth: number) => {
    if (avgSpanDepth === 0) {
      this.performScroll(0, true);
      this.currentLeftPos = 0;

      return;
    }

    const left = avgSpanDepth * (TOGGLE_BORDER_BOX / 2) - TOGGLE_BUTTON_MAX_WIDTH / 2;
    this.performScroll(left, true);
    this.currentLeftPos = left;
  };

  syncVirtualScrollbar = (spanBar: HTMLDivElement) => {
    // sync the virtual scrollbar's width to the spanBar's width

    if (!this.virtualScrollbar.current || !this.hasInteractiveLayer()) {
      return;
    }

    const virtualScrollbarDOM = this.virtualScrollbar.current;

    const maxContentWidth = spanBar.getBoundingClientRect().width;

    if (maxContentWidth === undefined || maxContentWidth <= 0) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    const visibleWidth =
      this.props.interactiveLayerRef.current!.getBoundingClientRect().width;

    // This is the width of the content not visible.
    const maxScrollDistance = maxContentWidth - visibleWidth;

    const virtualScrollbarWidth = visibleWidth / (visibleWidth + maxScrollDistance);

    if (virtualScrollbarWidth >= 1) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    virtualScrollbarDOM.style.width = `max(50px, ${toPercent(virtualScrollbarWidth)})`;

    virtualScrollbarDOM.style.removeProperty('transform');
  };

  addContentSpanBarRef = (instance: HTMLDivElement | null) => {
    if (instance) {
      this.contentSpanBar.add(instance);
    }
  };

  removeContentSpanBarRef = (instance: HTMLDivElement | null) => {
    if (instance) {
      this.contentSpanBar.delete(instance);
    }
  };

  hasInteractiveLayer = (): boolean => !!this.props.interactiveLayerRef.current;
  initialMouseClickX: number | undefined = undefined;

  performScroll = (scrollLeft: number, isAnimated?: boolean) => {
    const {interactiveLayerRef} = this.props;
    if (!interactiveLayerRef.current) {
      return;
    }

    if (isAnimated) {
      this.startAnimation();
    }

    const interactiveLayerRefDOM = interactiveLayerRef.current;
    const interactiveLayerRect = interactiveLayerRefDOM.getBoundingClientRect();
    interactiveLayerRefDOM.scrollLeft = scrollLeft;

    // Update scroll position of the virtual scroll bar
    selectRefs(this.scrollBarArea, (scrollBarAreaDOM: HTMLDivElement) => {
      selectRefs(this.virtualScrollbar, (virtualScrollbarDOM: HTMLDivElement) => {
        const scrollBarAreaRect = scrollBarAreaDOM.getBoundingClientRect();
        const virtualScrollbarPosition = scrollLeft / scrollBarAreaRect.width;

        const virtualScrollBarRect = rectOfContent(virtualScrollbarDOM);
        const maxVirtualScrollableArea =
          1 - virtualScrollBarRect.width / interactiveLayerRect.width;

        const virtualLeft =
          clamp(virtualScrollbarPosition, 0, maxVirtualScrollableArea) *
          interactiveLayerRect.width;

        virtualScrollbarDOM.style.transform = `translateX(${virtualLeft}px)`;
        virtualScrollbarDOM.style.transformOrigin = 'left';
      });
    });

    // Update scroll positions of all the span bars
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      const left = -scrollLeft;

      spanBarDOM.style.transform = `translateX(${left}px)`;
      spanBarDOM.style.transformOrigin = 'left';
    });
  };

  onWheel = (deltaX: number) => {
    if (this.isDragging || !this.hasInteractiveLayer()) {
      return;
    }

    this.disableAnimation();

    // Setting this here is necessary, since updating the virtual scrollbar position will also trigger the onScroll function
    this.isWheeling = true;

    if (this.wheelTimeout) {
      clearTimeout(this.wheelTimeout);
    }

    this.wheelTimeout = setTimeout(() => {
      this.isWheeling = false;
      this.wheelTimeout = null;
    }, 200);

    const interactiveLayerRefDOM = this.props.interactiveLayerRef.current!;

    const maxScrollLeft =
      interactiveLayerRefDOM.scrollWidth - interactiveLayerRefDOM.clientWidth;

    const scrollLeft = clamp(
      interactiveLayerRefDOM.scrollLeft + deltaX,
      0,
      maxScrollLeft
    );

    this.performScroll(scrollLeft);
  };

  onScroll = () => {
    if (this.isDragging || this.isWheeling || !this.hasInteractiveLayer()) {
      return;
    }

    const interactiveLayerRefDOM = this.props.interactiveLayerRef.current!;
    const scrollLeft = interactiveLayerRefDOM.scrollLeft;

    this.performScroll(scrollLeft);
  };

  onDragStart = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (
      this.isDragging ||
      event.type !== 'mousedown' ||
      !this.hasInteractiveLayer() ||
      !this.virtualScrollbar.current
    ) {
      return;
    }

    event.stopPropagation();

    const virtualScrollbarRect = rectOfContent(this.virtualScrollbar.current);

    // get initial x-coordinate of the mouse click on the virtual scrollbar
    this.initialMouseClickX = Math.abs(event.clientX - virtualScrollbarRect.x);

    // prevent the user from selecting things outside the minimap when dragging
    // the mouse cursor inside the minimap
    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor does not select text during a drag
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    // indicate drag has begun

    this.isDragging = true;

    selectRefs(this.virtualScrollbar, scrollbarDOM => {
      scrollbarDOM.classList.add('dragging');
      document.body.style.setProperty('cursor', 'grabbing', 'important');
    });
  };

  onDragMove = (event: MouseEvent) => {
    if (
      !this.isDragging ||
      event.type !== 'mousemove' ||
      !this.hasInteractiveLayer() ||
      !this.virtualScrollbar.current ||
      this.initialMouseClickX === undefined
    ) {
      return;
    }

    const virtualScrollbarDOM = this.virtualScrollbar.current;

    const interactiveLayerRect =
      this.props.interactiveLayerRef.current!.getBoundingClientRect();

    const virtualScrollBarRect = rectOfContent(virtualScrollbarDOM);

    // Mouse x-coordinate relative to the interactive layer's left side
    const localDragX = event.pageX - interactiveLayerRect.x;
    // The drag movement with respect to the interactive layer's width.
    const rawMouseX = (localDragX - this.initialMouseClickX) / interactiveLayerRect.width;

    const maxVirtualScrollableArea =
      1 - virtualScrollBarRect.width / interactiveLayerRect.width;

    // clamp rawMouseX to be within [0, 1]
    const virtualScrollbarPosition = clamp(rawMouseX, 0, 1);

    const virtualLeft =
      clamp(virtualScrollbarPosition, 0, maxVirtualScrollableArea) *
      interactiveLayerRect.width;

    virtualScrollbarDOM.style.transform = `translate3d(${virtualLeft}px, 0, 0)`;
    virtualScrollbarDOM.style.transformOrigin = 'left';

    const virtualScrollPercentage = clamp(rawMouseX / maxVirtualScrollableArea, 0, 1);

    // Update scroll positions of all the span bars

    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      const interactiveLayerRefDOM = this.props.interactiveLayerRef.current!;

      const maxScrollLeft =
        interactiveLayerRefDOM.scrollWidth - interactiveLayerRefDOM.clientWidth;

      const left = -lerp(0, maxScrollLeft, virtualScrollPercentage);

      spanBarDOM.style.transform = `translate3d(${left}px, 0, 0)`;
      spanBarDOM.style.transformOrigin = 'left';
    });

    // Update the scroll position of the scroll bar area
    selectRefs(
      this.props.interactiveLayerRef,
      (interactiveLayerRefDOM: HTMLDivElement) => {
        selectRefs(this.scrollBarArea, (scrollBarAreaDOM: HTMLDivElement) => {
          const maxScrollDistance =
            scrollBarAreaDOM.getBoundingClientRect().width - interactiveLayerRect.width;
          const left = lerp(0, maxScrollDistance, virtualScrollPercentage);

          interactiveLayerRefDOM.scrollLeft = left;
        });
      }
    );
  };

  onDragEnd = (event: MouseEvent) => {
    if (!this.isDragging || event.type !== 'mouseup' || !this.hasInteractiveLayer()) {
      return;
    }

    // remove listeners that were attached in onDragStart

    this.cleanUpListeners();

    // restore body styles

    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

    // indicate drag has ended

    this.isDragging = false;

    selectRefs(this.virtualScrollbar, scrollbarDOM => {
      scrollbarDOM.classList.remove('dragging');
      document.body.style.removeProperty('cursor');
    });
  };

  cleanUpListeners = () => {
    if (this.isDragging) {
      // we only remove listeners during a drag
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  startAnimation() {
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.style.transition = 'transform 0.3s';
    });

    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    // This timeout is set to trigger immediately after the animation ends, to disable the animation.
    // The animation needs to be cleared, otherwise manual horizontal scrolling will be animated
    this.animationTimeout = setTimeout(() => {
      selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
        spanBarDOM.style.transition = '';
      });
      this.animationTimeout = null;
    }, 300);
  }

  disableAnimation() {
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.style.transition = '';
    });
  }

  storeSpanBar = (spanBar: SpanBar | NewTraceDetailsSpanBar) => {
    this.spanBars.push(spanBar);
  };

  render() {
    const childrenProps: ScrollbarManagerChildrenProps = {
      addContentSpanBarRef: this.addContentSpanBarRef,
      updateHorizontalScrollState: this.updateHorizontalScrollState,
      removeContentSpanBarRef: this.removeContentSpanBarRef,
      onDragStart: this.onDragStart,
      onScroll: this.onScroll,
      onWheel: this.onWheel,
      virtualScrollbarRef: this.virtualScrollbar,
      scrollBarAreaRef: this.scrollBarArea,
      updateScrollState: this.initializeScrollState,
      storeSpanBar: this.storeSpanBar,
      getCurrentLeftPos: this.getCurrentLeftPos,
    };

    return (
      <ScrollbarManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </ScrollbarManagerContext.Provider>
    );
  }
}

export const Consumer = ScrollbarManagerContext.Consumer;

export const withScrollbarManager = <P extends ScrollbarManagerChildrenProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends Component<
    Omit<P, keyof ScrollbarManagerChildrenProps> & Partial<ScrollbarManagerChildrenProps>
  > {
    static displayName = `withScrollbarManager(${getDisplayName(WrappedComponent)})`;

    render() {
      return (
        <ScrollbarManagerContext.Consumer>
          {context => {
            const props = {
              ...this.props,
              ...context,
            } as P;

            // TODO(any): HoC types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
            return <WrappedComponent {...(props as any)} />;
          }}
        </ScrollbarManagerContext.Consumer>
      );
    }
  };
