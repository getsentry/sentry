import styled from '@emotion/styled';

import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import overflowEllipsisLeft from 'sentry/styles/overflowEllipsisLeft';

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
  ${p => (p.ellipsisDirection === 'right' ? overflowEllipsis : overflowEllipsisLeft)};
  width: auto;
  line-height: 1.2;
`;

TextOverflow.defaultProps = {
  ellipsisDirection: 'right',
  isParagraph: false,
};

export default TextOverflow;
