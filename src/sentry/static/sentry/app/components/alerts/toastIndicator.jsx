import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from '../inlineSvg';

const Toast = styled.div`
  position: fixed;
  right: 30px;
  bottom: 30px;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 15px 0 10px;
  background: #fff;
  background-image: linear-gradient(-180deg, rgba(255, 255, 255, 0.12) 0%, #f0eef5 100%);
  color: ${p => p.theme.gray5};
  border-radius: 44px 5px 5px 44px;
  box-shadow: 0 0 0 1px rgba(47, 40, 55, 0.12), 0 1px 2px 0 rgba(47, 40, 55, 0.12),
    0 4px 12px 0 rgba(47, 40, 55, 0.16);
  z-index: ${p => p.theme.zIndex.toast};
`;

const Icon = styled.div`
  margin-right: 6px;
  svg {
    display: block;
  }

  color: ${p => (p.type == 'success' ? p.theme.green : p.theme.red)};
`;

const Message = styled.div`
  flex: 1;
`;

function ToastIndicator({type, children}) {
  let icon;

  if (type == 'success') {
    icon = <InlineSvg src="icon-circle-check" size="24px" />;
  } else if (type == 'error') {
    icon = <InlineSvg src="icon-circle-close" size="24px" />;
  }
  return (
    <Toast>
      <Icon type={type}>{icon}</Icon>
      <Message>{children}</Message>
    </Toast>
  );
}

ToastIndicator.propTypes = {
  type: PropTypes.string.isRequired,
};

export default ToastIndicator;
