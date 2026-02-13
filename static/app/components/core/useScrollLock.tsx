import {useEffect, useId, useMemo} from 'react';

class Lock {
  private acquiredBy = new Set<string>();
  private initialOverflow: string | null = null;
  private initialPaddingRight: string | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  acquire(id: string) {
    if (this.acquiredBy.size === 0) {
      this.initialOverflow = this.container.style.overflow;
      this.container.style.overflow = 'hidden';
      // Compensate for the viewport scrollbar disappearing to prevent layout shift
      if (this.container === document.body) {
        this.initialPaddingRight = this.container.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        this.container.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    this.acquiredBy.add(id);
  }

  release(id: string) {
    this.acquiredBy.delete(id);

    if (this.acquiredBy.size === 0 && this.initialOverflow !== null) {
      this.container.style.overflow = this.initialOverflow;
      if (this.initialPaddingRight !== null) {
        this.container.style.paddingRight = this.initialPaddingRight;
        this.initialPaddingRight = null;
      }
      this.initialOverflow = null;
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
