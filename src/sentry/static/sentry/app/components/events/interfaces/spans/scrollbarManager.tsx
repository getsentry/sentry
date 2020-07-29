import React from 'react';

import {
  toPercent,
  clamp,
  rectOfContent,
  setBodyUserSelect,
  UserSelectValues,
  rectRelativeTo,
} from './utils';

export type ScrollbarManagerChildrenProps = {
  addScrollableSpanBarRef: () => React.RefObject<HTMLDivElement>;
  addContentSpanBarRef: () => React.RefObject<HTMLDivElement>;
  virtualScrollbarRef: React.RefObject<HTMLDivElement>;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

const ScrollbarManagerContext = React.createContext<ScrollbarManagerChildrenProps>({
  addScrollableSpanBarRef: () => React.createRef<HTMLDivElement>(),
  addContentSpanBarRef: () => React.createRef<HTMLDivElement>(),
  virtualScrollbarRef: React.createRef<HTMLDivElement>(),
  onDragStart: () => {},
});

const selectRefs = (
  refs: Array<React.RefObject<HTMLDivElement>> | React.RefObject<HTMLDivElement>,
  transform: (dividerDOM: HTMLDivElement) => void
) => {
  refs = !Array.isArray(refs) ? [refs] : refs;

  refs.forEach(ref => {
    if (ref.current) {
      transform(ref.current);
    }
  });
};

// simple linear interpolation between start and end such that needle in [0, 1]
const lerp = (start: number, end: number, needle: number) => {
  return start + needle * (end - start);
};

type Props = {
  children: React.ReactNode;
  dividerPosition: number;

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

    // Find the maximum content width. We set each content spanbar to be this maximum width,
    // such that all content spanbar widths are uniform.
    const maxContentWidth = this.scrollableSpanBar.reduce(
      (currentMaxWidth, currentSpanBar) => {
        if (!currentSpanBar.current) {
          return currentMaxWidth;
        }

        const maybeMaxWidth = currentSpanBar.current.scrollWidth;

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
    });

    console.log('maxContentWidth', maxContentWidth);

    // set initial scroll state for all scrollable spanbars
    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      spanBarDOM.scrollLeft = 0;
    });

    const spanBarRef = this.scrollableSpanBar.find(currentSpanBarRef => {
      return currentSpanBarRef.current;
    });

    if (spanBarRef) {
      const spanBarDOM = spanBarRef.current;
      if (spanBarDOM) {
        this.syncVirtualScrollbar(spanBarDOM);
      }
    }

    this.scrollableSpanBar.forEach(currentSpanBarRef => {
      if (currentSpanBarRef.current) {
        this.registerEventListeners(currentSpanBarRef.current);
      }
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.dividerPosition !== prevProps.dividerPosition) {
      const spanBarRef = this.scrollableSpanBar.find(currentSpanBarRef => {
        return currentSpanBarRef.current;
      });

      if (spanBarRef) {
        const spanBarDOM = spanBarRef.current;
        if (spanBarDOM) {
          this.syncVirtualScrollbar(spanBarDOM);
        }
      }
    }
  }

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  scrollableSpanBar: Array<React.RefObject<HTMLDivElement>> = [];
  contentSpanBar: Array<React.RefObject<HTMLDivElement>> = [];
  virtualScrollbar: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
  isDragging: boolean = false;
  previousUserSelect: UserSelectValues | null = null;

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
    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      if (scrolledSpanBar === spanBarDOM) {
        return;
      }

      /* Remove event listeners from the node that we'll manipulate */
      this.unregisterEventListeners(spanBarDOM);

      this.syncScrollPosition(scrolledSpanBar, spanBarDOM);
      this.syncVirtualScrollbar(scrolledSpanBar);

      /* Re-attach event listeners after we're done scrolling */
      window.requestAnimationFrame(() => {
        this.registerEventListeners(spanBarDOM);
      });
    });
  };

  syncScrollPosition = (scrolledSpanBar: HTMLDivElement, spanBarDOM: HTMLDivElement) => {
    const {
      // scrollTop,
      // scrollHeight,
      // clientHeight,
      scrollLeft,
      scrollWidth,
      clientWidth,
    } = scrolledSpanBar;

    // const scrollTopOffset = scrollHeight - clientHeight;
    const scrollLeftOffset = scrollWidth - clientWidth;

    if (scrollLeftOffset > 0) {
      spanBarDOM.scrollLeft = scrollLeft;
    }
  };

  syncVirtualScrollbar = (scrolledSpanBar: HTMLDivElement) => {
    if (!this.virtualScrollbar.current) {
      return;
    }

    const virtualScrollbarDOM = this.virtualScrollbar.current;

    const maxContentWidth = scrolledSpanBar.scrollWidth;

    if (maxContentWidth === undefined || maxContentWidth <= 0) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    const visibleWidth = scrolledSpanBar.getBoundingClientRect().width;
    const maxScrollDistance = scrolledSpanBar.scrollWidth - scrolledSpanBar.clientWidth;

    const virtualScrollbarWidth = visibleWidth / (visibleWidth + maxScrollDistance);

    if (virtualScrollbarWidth >= 1) {
      virtualScrollbarDOM.style.width = '0';
      return;
    }

    virtualScrollbarDOM.style.width = toPercent(virtualScrollbarWidth);

    const virtualScrollbarOffset =
      scrolledSpanBar.scrollLeft / (visibleWidth + maxScrollDistance);

    virtualScrollbarDOM.style.left = toPercent(virtualScrollbarOffset);
  };

  addScrollableSpanBarRef = () => {
    const ref = React.createRef<HTMLDivElement>();
    this.scrollableSpanBar.push(ref);
    return ref;
  };

  addContentSpanBarRef = () => {
    const ref = React.createRef<HTMLDivElement>();
    this.contentSpanBar.push(ref);
    return ref;
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

    const interactiveRect = rectOfContent(this.props.interactiveLayerRef.current!);
    const virtualScrollbarRect = rectOfContent(this.virtualScrollbar.current);
    // const localVirtualScrollbarRect = rectRelativeTo(
    //   virtualScrollbarRect,
    //   interactiveRect
    // );

    // get intitial x-coordinate of the mouse click on the virtual scrollbar
    this.initialMouseClickX = Math.abs(event.clientX - virtualScrollbarRect.x);
    console.log('initialMouseClickX', this.initialMouseClickX);

    // get x-coordinate on where the virtual scrollbar was clicked
    // console.log('mouseDraggingX', this.mouseDraggingX);

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

    // mouse x-coordinate relative to the interactive layer's left side
    const rawMouseX = (event.pageX - rect.x - this.initialMouseClickX) / rect.width;

    const min = 0;
    const max = 1 - virtualScrollBarRect.width / rect.width;

    // clamp rawMouseX to be within [0, 1]
    const virtualScrollbarPosition = clamp(rawMouseX, min, 1);

    virtualScrollbarDOM.style.left = `clamp(0%, calc(${toPercent(
      virtualScrollbarPosition
    )}), ${toPercent(max)})`;

    const virtualScrollPercentage = clamp(rawMouseX / max, 0, 1);

    selectRefs(this.scrollableSpanBar, (spanBarDOM: HTMLDivElement) => {
      /* Remove event listeners from the node that we'll manipulate */
      this.unregisterEventListeners(spanBarDOM);

      const maxScrollDistance = spanBarDOM.scrollWidth - spanBarDOM.clientWidth;

      spanBarDOM.scrollLeft = lerp(0, maxScrollDistance, virtualScrollPercentage);

      /* Re-attach event listeners after we're done scrolling */
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
      addScrollableSpanBarRef: this.addScrollableSpanBarRef,
      addContentSpanBarRef: this.addContentSpanBarRef,
      onDragStart: this.onDragStart,
      virtualScrollbarRef: this.virtualScrollbar,
    };

    return (
      <ScrollbarManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </ScrollbarManagerContext.Provider>
    );
  }
}

export const Consumer = ScrollbarManagerContext.Consumer;
