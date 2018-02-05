import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from '../inlineSvg';
import LoadingIndicator from '../../components/loadingIndicator';

const Toast = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 15px 0 10px;
  margin-top: 15px;
  background: #fff;
  background-image: linear-gradient(
    -180deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(240, 238, 245, 0.35) 98%
  );
  color: ${p => p.theme.gray5};
  border-radius: 44px 5px 5px 44px;
  box-shadow: 0 0 0 1px rgba(47, 40, 55, 0.12), 0 1px 2px 0 rgba(47, 40, 55, 0.12),
    0 4px 12px 0 rgba(47, 40, 55, 0.16);
  z-index: ${p => p.theme.zIndex.toast};
  transition: opacity 0.25s linear;

  &.toast-enter {
    opacity: 0;
  }

  &.toast-enter-active {
    opacity: 1;
  }

  &.toast-leave {
    opacity: 1;
  }

  &.toast-leave-active {
    opacity: 0;
  }
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

function ToastIndicator({type, children, ...props}) {
  let icon;

  if (type == 'success') {
    icon = <InlineSvg src="icon-circle-check" size="24px" />;
  } else if (type == 'error') {
    icon = <InlineSvg src="icon-circle-close" size="24px" />;
  }
  return (
    <Toast {...props}>
      {type == 'loading' ? <LoadingIndicator mini /> : <Icon type={type}>{icon}</Icon>}
      <Message>{children}</Message>
    </Toast>
  );
}

ToastIndicator.propTypes = {
  type: PropTypes.string.isRequired,
};

export default ToastIndicator;
