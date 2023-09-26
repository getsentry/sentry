import {useEffect} from 'react';

export const focusableElements = [
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'button:not([disabled])',
].join(',');

export const useFocusTrap = (ref: React.RefObject<HTMLElement>, autofocus?: boolean) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return () => {};
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const focusable = element.querySelectorAll(focusableElements);
      const firstFocusable = focusable[0] as HTMLElement;
      const lastFocusable = focusable[focusable.length - 1] as HTMLElement;

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            event.preventDefault();
          }
        } else if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (element && autofocus) {
      const focusable = element.querySelectorAll(focusableElements);
      const firstFocusable = focusable[0] as HTMLElement;
      firstFocusable.focus();
    }
  }, [ref, autofocus]);
};
