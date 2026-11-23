import {useEffect, useId, useMemo} from 'react';

class Lock {
  private acquiredBy = new Set<string>();
  private initialOverflow: string | null = null;
  private initialBodyStyles: {
    left: string;
    paddingRight: string;
    position: string;
    right: string;
    top: string;
    width: string;
  } | null = null;
  private scroll: {x: number; y: number} = {x: 0, y: 0};
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  acquire(id: string) {
    if (this.acquiredBy.size === 0) {
      if (this.container === document.body) {
        // Keep root overflow unchanged so sticky sidebars stay visible.
        this.scroll = {x: window.scrollX, y: window.scrollY};
        this.initialBodyStyles = {
          position: document.body.style.position,
          top: document.body.style.top,
          left: document.body.style.left,
          right: document.body.style.right,
          width: document.body.style.width,
          paddingRight: document.body.style.paddingRight,
        };

        const existingPaddingRight =
          Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
        // Fixing the body removes the root scrollbar, so the width it gives back
        // is the scrollbar width. Measure layout widths: on iOS, innerWidth
        // follows the pinch-zoomed visual viewport instead.
        const widthBeforeLock = document.documentElement.clientWidth;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scroll.y}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        const scrollbarWidth = Math.max(
          0,
          document.documentElement.clientWidth - widthBeforeLock
        );
        document.documentElement.style.setProperty(
          '--scrollbar-size',
          `${scrollbarWidth}px`
        );
        document.body.style.paddingRight = `${existingPaddingRight + scrollbarWidth}px`;
      } else {
        this.initialOverflow = this.container.style.overflow;
        this.container.style.overflow = 'hidden';
      }
    }
    this.acquiredBy.add(id);
  }

  release(id: string) {
    this.acquiredBy.delete(id);

    if (this.acquiredBy.size === 0) {
      if (this.initialBodyStyles !== null) {
        document.body.style.position = this.initialBodyStyles.position;
        document.body.style.top = this.initialBodyStyles.top;
        document.body.style.left = this.initialBodyStyles.left;
        document.body.style.right = this.initialBodyStyles.right;
        document.body.style.width = this.initialBodyStyles.width;
        document.body.style.paddingRight = this.initialBodyStyles.paddingRight;
        document.documentElement.style.removeProperty('--scrollbar-size');
        // Restore in the same task. scrollTo forces layout with the restored
        // styles, and an acquire right after this release (one modal replacing
        // another) must read the restored scroll position, not the pinned 0.
        window.scrollTo(this.scroll.x, this.scroll.y);
        this.initialBodyStyles = null;
      }

      if (this.initialOverflow !== null) {
        this.container.style.overflow = this.initialOverflow;
        this.initialOverflow = null;
      }
    }
  }

  held(): boolean {
    return this.acquiredBy.size > 0;
  }
}

const LockMap = new WeakMap<HTMLElement, Lock>();

export function useScrollLock(container: HTMLElement) {
  const id = useId();

  const lock = useMemo(() => {
    let globalLock = LockMap.get(container);

    if (!globalLock) {
      globalLock = new Lock(container);
      LockMap.set(container, globalLock);
    }

    return globalLock;
  }, [container]);

  // Keep the Lock in LockMap after release. Other mounted hooks still hold this
  // instance, and a second Lock for the same container would save and restore
  // its styles independently, leaving the page stuck or unlocked.
  useEffect(() => {
    return () => lock.release(id);
  }, [lock, id]);

  return useMemo(() => {
    return {
      acquire: () => lock.acquire(id),
      release: () => lock.release(id),
      held: () => lock.held(),
    };
  }, [lock, id]);
}
