import {useLayoutEffect, useMemo, useState} from 'react';

import {
  asyncSanitizedMarked,
  sanitizedMarked,
  singleLineRenderer,
} from 'sentry/utils/marked/marked';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';

interface BaseMarkedTextProps<T extends React.ElementType> {
  /**
   * The markdown text
   */
  text: string;
  /**
   * The element type to render as. Defaults to 'div'.
   */
  as?: T;
  /**
   * Wether to wrap the markdown in a paragraph tag.
   */
  inline?: boolean;
}

type MarkedTextProps<T extends React.ElementType> = BaseMarkedTextProps<T> &
  Omit<React.ComponentPropsWithRef<T>, keyof BaseMarkedTextProps<T>>;

// Default element type if 'as' is not provided
const defaultElement = 'div';

/**
 * A component that renders sanitized markdown text.
 *
 * ```tsx
 * <MarkedText text="**Hello, world!**" />
 * ```
 */
export function MarkedText<T extends React.ElementType = typeof defaultElement>({
  as,
  text,
  inline,
  ...props
}: MarkedTextProps<T>) {
  const [renderedHtml, setRenderedHtml] = useState(() =>
    // Initialize placeholder without syntax highlighting
    inline ? singleLineRenderer(text) : sanitizedMarked(text)
  );
  const isMountedRef = useIsMountedRef();

  // This could use react 19's "use" hook with suspsense but currently throws act warnings in tests
  // https://github.com/testing-library/react-testing-library/issues/1375
  const markedHtmlPromise = useMemo(
    () => asyncSanitizedMarked(text, inline),
    [text, inline]
  );

  useLayoutEffect(() => {
    markedHtmlPromise.then(html => {
      if (isMountedRef.current) {
        setRenderedHtml(html);
      }
    });
  }, [markedHtmlPromise, text, inline, isMountedRef]);

  const Component = as || defaultElement;

  return <Component dangerouslySetInnerHTML={{__html: renderedHtml}} {...props} />;
}
