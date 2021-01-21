import React from 'react';

import getDisplayName from 'app/utils/getDisplayName';
import {setBodyUserSelect, UserSelectValues} from 'app/utils/userselect';

import {DragManagerChildrenProps} from './dragManager';
import {clamp, rectOfContent, toPercent} from './utils';

export type ScrollbarManagerChildrenProps = {
  generateScrollableSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  generateContentSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  virtualScrollbarRef: React.RefObject<HTMLDivElement>;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  updateScrollState: () => void;
};

const ScrollbarManagerContext = React.createContext<ScrollbarManagerChildrenProps>({
  generateScrollableSpanBarRef: () => () => undefined,
  generateContentSpanBarRef: () => () => undefined,
  virtualScrollbarRef: React.createRef<HTMLDivElement>(),
  onDragStart: () => {},
  updateScrollState: () => {},
});

const selectRefs = (
  refs: Set<HTMLDivElement> | React.RefObject<HTMLDivElement>,
  transform: (dividerDOM: HTMLDivElement) => void
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
  dragProps: DragManagerChildrenProps;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type State = {
  maxContentWidth: number | undefined;
};

export class Provider extends React.Component<Props, State> {
  state: State = {
    maxContentWidth: undefined,
  };

  componentDidMount() {
    // React will guarantee that refs are set before componentDidMount() is called;
    // but only for DOM elements that actually got rendered

    this.initializeScrollState();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.dividerPosition !== prevProps.dividerPosition) {
      // Find any span bar and adjust the virtual scroll bar's scroll position
      // with respect to this span bar.

      if (this.scrollableSpanBar.size === 0) {
        return;
      }

      const spanBarDOM = this.getReferenceSpanBar();
      if (spanBarDOM) {
        this.syncVirtualScrollbar(spanBarDOM);
      }

      return;
    }

    // If the window was selected via the minimap, then re-initialize the scroll state.

    const viewWindowChanged =
      prevProps.dragProps.viewWindowStart !== this.props.dragProps.viewWindowStart ||
      prevProps.dragProps.viewWindowEnd !== this.props.dragProps.viewWindowEnd;

    if (viewWindowChanged) {
      this.initializeScrollState();
    }
  }

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  scrollableSpanBar: Set<HTMLDivElement> = new Set();
  contentSpanBar: Set<HTMLDivElement> = new Set();
  virtualScrollbar: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
  isDragging: boolean = false;
  previousUserSelect: UserSelectValues | null = null;

  getReferenceSpanBar() {
    for (const currentSpanBar of this.scrollableSpanBar) {
      const isHidden = currentSpanBar.offsetParent === null;
      if (!document.body.contains(currentSpanBar) || isHidden) {
        continue;
      }
      return currentSpanBar;
    }

    return undefined;
  }

  initializeScrollState = () => {
    if (this.scrollableSpanBar.size === 0 || this.contentSpanBar.size === 0) {
      return;
    }

    // set initial scroll state for all scrollable spanbars
    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.scrollLeft = 0;
    });

    // reset all span bar content containers to their natural widths
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.style.removeProperty('width');
      spanBarDOM.style.removeProperty('max-width');
      spanBarDOM.style.removeProperty('overflow');
    });

    // Find the maximum content width. We set each content spanbar to be this maximum width,
    // such that all content spanbar widths are uniform.
    const maxContentWidth = Array.from(this.scrollableSpanBar).reduce(
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

    this.scrollableSpanBar.forEach(currentSpanBarRef => {
      this.unregisterEventListeners(currentSpanBarRef);
    });

    const spanBarDOM = this.getReferenceSpanBar();

    if (spanBarDOM) {
      this.syncVirtualScrollbar(spanBarDOM);
    }

    this.scrollableSpanBar.forEach(currentSpanBarRef => {
      this.registerEventListeners(currentSpanBarRef);
    });
  };

  registerEventListeners = (spanbar: HTMLDivElement) => {
    spanbar.onscroll = this.handleScroll.bind(this, spanbar);
  };

  unregisterEventListeners = (spanbar: HTMLDivElement) => {
    spanbar.onscroll = null;
  };

  handleScroll = (spanbar: HTMLDivElement) => {
    window.requestAnimationFrame(() => {
      this.syncScrollPositions(spanbar);
    });
  };

  syncScrollPositions = (scrolledSpanBar: HTMLDivElement) => {
    // Sync scroll positions of all span bars with respect to scrolledSpanBar's
    // scroll position

    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      if (scrolledSpanBar === spanBarDOM) {
        // Don't sync scrolledSpanBar's scroll position with itself
        return;
      }

      this.unregisterEventListeners(spanBarDOM);
      this.syncScrollPosition(scrolledSpanBar, spanBarDOM);
      this.syncVirtualScrollbar(scrolledSpanBar);

      window.requestAnimationFrame(() => {
        this.registerEventListeners(spanBarDOM);
      });
    });
  };

  syncScrollPosition = (scrolledSpanBar: HTMLDivElement, spanBarDOM: HTMLDivElement) => {
    // sync spanBarDOM's scroll position with respect to scrolledSpanBar's
    // scroll position

    const {scrollLeft, scrollWidth, clientWidth} = scrolledSpanBar;

    const scrollLeftOffset = scrollWidth - clientWidth;

    if (scrollLeftOffset > 0) {
      spanBarDOM.scrollLeft = scrollLeft;
    }
  };

  syncVirtualScrollbar = (scrolledSpanBar: HTMLDivElement) => {
    // sync the virtual scrollbar's scroll position with respect to scrolledSpanBar's
    // scroll position

    if (!this.virtualScrollbar.current || !this.hasInteractiveLayer()) {
      return;
    }

    const virtualScrollbarDOM = this.virtualScrollbar.current;

    const maxContentWidth = scrolledSpanBar.scrollWidth;

    if (maxContentWidth === undefined || maxContentWidth <= 0) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    const visibleWidth = scrolledSpanBar.getBoundingClientRect().width;
    // This is the scroll width of the content not visible on the screen due to overflow.
    const maxScrollDistance = scrolledSpanBar.scrollWidth - scrolledSpanBar.clientWidth;

    const virtualScrollbarWidth = visibleWidth / (visibleWidth + maxScrollDistance);

    if (virtualScrollbarWidth >= 1) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    virtualScrollbarDOM.style.width = `max(50px, ${toPercent(virtualScrollbarWidth)})`;

    const rect = rectOfContent(this.props.interactiveLayerRef.current!);
    const virtualScrollBarRect = rectOfContent(virtualScrollbarDOM);
    const maxVirtualScrollableArea = 1 - virtualScrollBarRect.width / rect.width;

    // Assume scrollbarLeftOffset = lerp(0, maxScrollDistance, virtualScrollPercentage).
    // Then solve for virtualScrollPercentage.
    const virtualScrollPercentage = clamp(
      scrolledSpanBar.scrollLeft / maxScrollDistance,
      0,
      1
    );
    const virtualScrollbarPosition = virtualScrollPercentage * maxVirtualScrollableArea;

    virtualScrollbarDOM.style.left = `clamp(0%, calc(${toPercent(
      virtualScrollbarPosition
    )}), calc(100% - max(50px, ${toPercent(virtualScrollbarWidth)})))`;
  };

  generateScrollableSpanBarRef = () => {
    let previousInstance: HTMLDivElement | null = null;

    const addScrollableSpanBarRef = (instance: HTMLDivElement | null) => {
      if (previousInstance) {
        this.scrollableSpanBar.delete(previousInstance);
        previousInstance = null;
      }

      if (instance) {
        this.scrollableSpanBar.add(instance);
        previousInstance = instance;
      }
    };

    return addScrollableSpanBarRef;
  };

  generateContentSpanBarRef = () => {
    let previousInstance: HTMLDivElement | null = null;

    const addContentSpanBarRef = (instance: HTMLDivElement | null) => {
      if (previousInstance) {
        this.contentSpanBar.delete(previousInstance);
        previousInstance = null;
      }

      if (instance) {
        this.contentSpanBar.add(instance);
        previousInstance = instance;
      }
    };

    return addContentSpanBarRef;
  };

  hasInteractiveLayer = (): boolean => !!this.props.interactiveLayerRef.current;
  initialMouseClickX: number | undefined = undefined;

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

    // get intitial x-coordinate of the mouse click on the virtual scrollbar
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

    selectRefs(this.virtualScrollbar, dividerDOM => {
      dividerDOM.classList.add('dragging');
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

    const rect = rectOfContent(this.props.interactiveLayerRef.current!);
    const virtualScrollBarRect = rectOfContent(virtualScrollbarDOM);

    // Mouse x-coordinate relative to the interactive layer's left side
    const localDragX = event.pageX - rect.x;
    // The drag movement with respect to the interactive layer's width.
    const rawMouseX = (localDragX - this.initialMouseClickX) / rect.width;

    const maxVirtualScrollableArea = 1 - virtualScrollBarRect.width / rect.width;

    // clamp rawMouseX to be within [0, 1]
    const virtualScrollbarPosition = clamp(rawMouseX, 0, 1);

    virtualScrollbarDOM.style.left = `clamp(0%, calc(${toPercent(
      virtualScrollbarPosition
    )}), ${toPercent(maxVirtualScrollableArea)})`;

    const virtualScrollPercentage = clamp(rawMouseX / maxVirtualScrollableArea, 0, 1);

    // Update scroll positions of all the span bars

    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      this.unregisterEventListeners(spanBarDOM);

      const maxScrollDistance = spanBarDOM.scrollWidth - spanBarDOM.clientWidth;

      spanBarDOM.scrollLeft = lerp(0, maxScrollDistance, virtualScrollPercentage);

      window.requestAnimationFrame(() => {
        this.registerEventListeners(spanBarDOM);
      });
    });
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

    selectRefs(this.virtualScrollbar, dividerDOM => {
      dividerDOM.classList.remove('dragging');
    });
  };

  cleanUpListeners = () => {
    if (this.isDragging) {
      // we only remove listeners during a drag
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  render() {
    const childrenProps: ScrollbarManagerChildrenProps = {
      generateScrollableSpanBarRef: this.generateScrollableSpanBarRef,
      generateContentSpanBarRef: this.generateContentSpanBarRef,
      onDragStart: this.onDragStart,
      virtualScrollbarRef: this.virtualScrollbar,
      updateScrollState: this.initializeScrollState,
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
  class extends React.Component<
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

            return <WrappedComponent {...props} />;
          }}
        </ScrollbarManagerContext.Consumer>
      );
    }
  };
