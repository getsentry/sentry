import * as React from 'react';

import {
  clamp,
  rectOfContent,
  toPercent,
} from 'app/components/performance/waterfall/utils';
import getDisplayName from 'app/utils/getDisplayName';
import {setBodyUserSelect, UserSelectValues} from 'app/utils/userselect';

import {DragManagerChildrenProps} from './dragManager';

export type ScrollbarManagerChildrenProps = {
  generateContentSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  virtualScrollbarRef: React.RefObject<HTMLDivElement>;
  scrollBarAreaRef: React.RefObject<HTMLDivElement>;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onScroll: () => void;
  updateScrollState: () => void;
};

const ScrollbarManagerContext = React.createContext<ScrollbarManagerChildrenProps>({
  generateContentSpanBarRef: () => () => undefined,
  virtualScrollbarRef: React.createRef<HTMLDivElement>(),
  scrollBarAreaRef: React.createRef<HTMLDivElement>(),
  onDragStart: () => {},
  onScroll: () => {},
  updateScrollState: () => {},
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
  dragProps?: DragManagerChildrenProps;

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

    if (dividerPositionChanged || viewWindowChanged) {
      this.initializeScrollState();
    }
  }

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  contentSpanBar: Set<HTMLDivElement> = new Set();
  virtualScrollbar: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
  scrollBarArea: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
  isDragging: boolean = false;
  previousUserSelect: UserSelectValues | null = null;

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

  onScroll = () => {
    if (this.isDragging || !this.hasInteractiveLayer()) {
      return;
    }

    const interactiveLayerRefDOM = this.props.interactiveLayerRef.current!;

    const interactiveLayerRect = interactiveLayerRefDOM.getBoundingClientRect();
    const scrollLeft = interactiveLayerRefDOM.scrollLeft;

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

        virtualScrollbarDOM.style.transform = `translate3d(${virtualLeft}px, 0, 0)`;
        virtualScrollbarDOM.style.transformOrigin = 'left';
      });
    });

    // Update scroll positions of all the span bars
    selectRefs(this.contentSpanBar, (spanBarDOM: HTMLDivElement) => {
      const left = -scrollLeft;

      spanBarDOM.style.transform = `translate3d(${left}px, 0, 0)`;
      spanBarDOM.style.transformOrigin = 'left';
    });
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
      const maxScrollDistance =
        spanBarDOM.getBoundingClientRect().width - interactiveLayerRect.width;

      const left = -lerp(0, maxScrollDistance, virtualScrollPercentage);

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

  render() {
    const childrenProps: ScrollbarManagerChildrenProps = {
      generateContentSpanBarRef: this.generateContentSpanBarRef,
      onDragStart: this.onDragStart,
      onScroll: this.onScroll,
      virtualScrollbarRef: this.virtualScrollbar,
      scrollBarAreaRef: this.scrollBarArea,
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
