import {useMarked} from './useMarked';

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
 * Displays a placeholder while syntax highlighting is loading.
 *
 * ```tsx
 * <MarkedText text="**Hello, world!**" />
 * ```
 */
export function MarkedText<T extends React.ElementType = typeof defaultElement>({
  as,
  text,
  inline,
  ref,
  ...rest
}: MarkedTextProps<T>) {
  const {data: markdownData} = useMarked({text, inline});

  const Component = as || defaultElement;

  return (
    <Component
      ref={ref}
      dangerouslySetInnerHTML={{__html: markdownData ?? ''}}
      {...rest}
    />
  );
}
