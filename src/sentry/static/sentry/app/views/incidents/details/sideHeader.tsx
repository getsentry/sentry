import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  className?: string;
  loading?: boolean;
  children: React.ReactNode;
};

const SideHeader = styled(function SideHeader({className, loading, children}: Props) {
  return (
    <h6 className={className}>
      <Title loading={loading}>{children}</Title>
    </h6>
  );
})`
  color: ${p => p.theme.gray2};
  font-weight: bold;
  margin-bottom: ${space(1)};
  text-transform: uppercase;
`;

const Title = styled('span', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<{loading?: boolean}>`
  ${p =>
    p.loading
      ? `
  background-color: ${p.theme.placeholderBackground};
  color: ${p.theme.placeholderBackground};
  `
      : ''};
`;

export default SideHeader;
