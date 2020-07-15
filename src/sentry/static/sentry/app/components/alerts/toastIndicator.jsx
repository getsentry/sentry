import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {t} from 'app/locale';
import {IconCheckmark, IconClose} from 'app/icons';
import LoadingIndicator from 'app/components/loadingIndicator';
import testableTransition from 'app/utils/testableTransition';

const Toast = styled(motion.div)`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 15px 0 10px;
  margin-top: 15px;
  background: ${p => p.theme.gray800};
  color: #fff;
  border-radius: 44px 7px 7px 44px;
  box-shadow: 0 4px 12px 0 rgba(47, 40, 55, 0.16);
  position: relative;
`;

Toast.defaultProps = {
  initial: {
    opacity: 0,
    y: 70,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: 70,
  },
  transition: testableTransition({
    type: 'spring',
    stiffness: 450,
    damping: 25,
  }),
};

const Icon = styled('div')`
  margin-right: 6px;
  svg {
    display: block;
  }

  color: ${p => (p.type === 'success' ? p.theme.green400 : p.theme.red400)};
`;

const Message = styled('div')`
  flex: 1;
`;

const Undo = styled('div')`
  display: inline-block;
  color: ${p => p.theme.gray500};
  padding-left: 16px;
  margin-left: 16px;
  border-left: 1px solid ${p => p.theme.gray3};
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  .loading-indicator {
    border-color: ${p => p.theme.gray700};
    border-left-color: ${p => p.theme.purple400};
  }
`;

function ToastIndicator({indicator, onDismiss, className, ...props}) {
  let icon;
  const {options, message, type} = indicator;
  const {undo, disableDismiss} = options || {};
  const showUndo = typeof undo === 'function';
  const handleClick = e => {
    if (disableDismiss) {
      return;
    }
    if (typeof onDismiss === 'function') {
      onDismiss(indicator, e);
    }
  };

  if (type === 'success') {
    icon = <IconCheckmark size="lg" isCircled />;
  } else if (type === 'error') {
    icon = <IconClose size="lg" isCircled />;
  }

  // TODO(billy): Remove ref- className after removing usage from getsentry

  return (
    <Toast
      onClick={handleClick}
      data-test-id={type ? `toast-${type}` : 'toast'}
      className={classNames(className, 'ref-toast', `ref-${type}`)}
      {...props}
    >
      {type === 'loading' ? (
        <StyledLoadingIndicator mini />
      ) : (
        <Icon type={type}>{icon}</Icon>
      )}
      <Message>{message}</Message>
      {showUndo && <Undo onClick={undo}>{t('Undo')}</Undo>}
    </Toast>
  );
}

ToastIndicator.propTypes = {
  indicator: PropTypes.shape({
    type: PropTypes.oneOf(['error', 'success', 'loading', 'undo', '']),
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    message: PropTypes.node,
    options: PropTypes.object,
  }),
  onDismiss: PropTypes.func,
};

export default ToastIndicator;
