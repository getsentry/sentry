import styled from '@emotion/styled';

type Props = {
  children: React.ReactNode;
  className?: string;
  ['data-test-id']?: string;
  ellipsisDirection?: 'left' | 'right';
  isParagraph?: boolean;
};

const TextOverflow = styled(
  ({isParagraph, className, children, ['data-test-id']: dataTestId}: Props) => {
    const Component = isParagraph ? 'p' : 'div';
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
