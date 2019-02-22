import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

const HeroIcon = styled(props => {
  return <InlineSvg {...props} />;
})`
  color: ${p => p.theme.gray6};
`;

HeroIcon.defaultProps = {
  size: '72px',
};

export default HeroIcon;
