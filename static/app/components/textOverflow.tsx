import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  className?: string;
  ['data-test-id']?: string;
  /**
   * Change which side of the text is elided.
   * Default: 'right'
   *
   * BROWSER COMPAT:
   * When set to `left` the intention is for something like: `...xample.com/foo/`
   * In Chrome & Firefox this is what happens.
   *
   * In Safari (July 2022) you will see this instead: `...https://example.co`.
   *
   * See: https://stackoverflow.com/a/24800788
   */
  ellipsisDirection?: 'left' | 'right';
  isParagraph?: boolean;
};

const TextOverflow = styled(
  ({
    children,
    className,
    ellipsisDirection,
    isParagraph,
    ['data-test-id']: dataTestId,
  }: Props) => {
    const Component = isParagraph ? 'p' : 'div';
    if (ellipsisDirection === 'left') {
      return (
        <Component className={className} data-test-id={dataTestId}>
          <bdi>{children}</bdi>
        </Component>
      );
    }
    return (
      <Component className={className} data-test-id={dataTestId}>
        {children}
      </Component>
    );
  }
)`
  ${p => p.theme.overflowEllipsis}
  ${p =>
    p.ellipsisDirection === 'left' &&
    `
      direction: rtl;
      text-align: left;
    `};
  width: auto;
  line-height: 1.2;
`;

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false,
};

export default TextOverflow;
