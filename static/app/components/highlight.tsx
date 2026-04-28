import {Fragment} from 'react';

type HighlightProps = {
  /**
   * The original text
   */
  children: string;
  /**
   * The text to highlight
   */
  text: string;
  /**
   * Whether to only highlight text that matches case too
   */
  caseSensitive?: boolean;
  /**
   * Should highlighting be disabled?
   */
  disabled?: boolean;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof HighlightProps> &
  HighlightProps;

function HighlightComponent({caseSensitive, className, children, disabled, text}: Props) {
  // There are instances when children is not string in breadcrumbs but not caught by TS
  if (!text || disabled || typeof children !== 'string') {
    return <Fragment>{children}</Fragment>;
  }

  const idx = caseSensitive
    ? children.indexOf(text)
    : children.toLowerCase().indexOf(text.toLowerCase());

  if (idx === -1) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Fragment>
      {children.substring(0, idx)}
      <span className={className}>{children.substring(idx, idx + text.length)}</span>
      {children.substring(idx + text.length)}
    </Fragment>
  );
}

export {HighlightComponent};
