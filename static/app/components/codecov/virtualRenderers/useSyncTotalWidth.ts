import {useLayoutEffect} from 'react';

interface UseSyncTotalWidthArgs {
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  widthDivRef: React.RefObject<HTMLDivElement | null>;
}

export const useSyncTotalWidth = ({textAreaRef, widthDivRef}: UseSyncTotalWidthArgs) => {
  // this effect sets an empty div to the width of the text area so the code highlight div can scroll horizontally
  useLayoutEffect(() => {
    // if the text area or width div ref is not available, return
    if (!textAreaRef.current || !widthDivRef.current) {
      return undefined;
    }

    // create a resize observer to watch the text area for changes in width so once the text area is resized, the width div can be updated
    const resize = new ResizeObserver(entries => {
      const entry = entries?.[0];
      if (widthDivRef.current && entry) {
        widthDivRef.current.style.width = `${entry.target.scrollWidth}px`;
      }
    });

    // observe the text area for changes
    resize.observe(textAreaRef.current);

    return () => {
      // disconnect the resize observer
      resize.disconnect();
    };
  }, [textAreaRef, widthDivRef]);
};
