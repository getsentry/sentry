import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

const HeroIcon = styled(props => {
  let {size = 72, ...otherProps} = props;
  return <InlineSvg size={size} {...otherProps} />;
})`
  color: ${p => p.theme.gray6};
`;
export default HeroIcon;
