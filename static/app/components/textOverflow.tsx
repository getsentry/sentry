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
   * In FF/Chrome this is what happens.
   *
   * In Safari you will see this instead: `...https://exmaple.co`
   *
   * See: https://stackoverflow.com/a/24800788
   */
  ellipsisDirection?: 'left' | 'right';
  isParagraph?: boolean;
};

const TextOverflow = styled(
  ({isParagraph, className, children, ['data-test-id']: dataTestId}: Props) => {
    const Component = isParagraph ? 'p' : 'div';
    return (
      <Component className={className} data-test-id={dataTestId}>
        <bdi>{children}</bdi>
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
      overflow: hidden;
    `};
  width: auto;
  line-height: 1.2;
`;

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false,
};

export default TextOverflow;
