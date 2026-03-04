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

        // Measure scrollbar width before fixing body removes it.
        const scrollbarWidth = window.innerWidth - document.body.clientWidth;
        const existingPaddingRight =
          Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scroll.y}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
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
        const {x, y} = this.scroll ?? {x: 0, y: 0};
        requestAnimationFrame(() => {
          window.scrollTo(x, y);
        });
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

const LockMap = new Map<HTMLElement, Lock>();

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

  useEffect(() => {
    return () => {
      lock.release(id);

      if (!lock.held()) {
        LockMap.delete(container);
      }
    };
  }, [container, lock, id]);

  return useMemo(() => {
    return {
      acquire: () => lock.acquire(id),
      release: () => lock.release(id),
    };
  }, [lock, id]);
}
