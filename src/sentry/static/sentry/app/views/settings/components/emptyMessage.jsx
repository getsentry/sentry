import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.gray4};
  padding: ${p => p.theme.grid * 3}px;
  font-size: ${p => (p.theme.large ? p.theme.fontSizeExtraLarge : p.theme.fontSizeLarge)};
  font-weight: bold;
`;

const StyledInlineSvg = styled(InlineSvg)`
  display: block;
  color: ${p => p.theme.gray1};
  width: 2em;
  height: 2em;
  margin-bottom: 0.75em;
`;

const Action = styled.div`
  display: block;
  margin-top: 0.75em;
`;

const EmptyMessage = ({icon, children, action, size}) => {
  return (
    <Wrapper size={size}>
      {icon && <StyledInlineSvg src={icon} />}
      <div className="ref-message">{children}</div>
      {action && <Action>{action}</Action>}
    </Wrapper>
  );
};

EmptyMessage.propTypes = {
  icon: PropTypes.string,
  action: PropTypes.element,
  size: PropTypes.oneOf(['large', 'medium']),
};

export default EmptyMessage;
