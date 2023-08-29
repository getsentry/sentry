import styled from '@emotion/styled';
import classNames from 'classnames';
import {motion} from 'framer-motion';

import {Indicator} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

type Props = {
  indicator: Indicator;
  onDismiss: (indicator: Indicator, event: React.MouseEvent) => void;
  className?: string;
};

function ToastIndicator({indicator, onDismiss, className, ...props}: Props) {
  let icon: React.ReactNode;
  const {options, message, type} = indicator;
  const {undo, disableDismiss} = options || {};
  const showUndo = typeof undo === 'function';
  const handleClick = (e: React.MouseEvent) => {
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
      {showUndo && (
        <Undo priority="link" onClick={undo}>
          {t('Undo')}
        </Undo>
      )}
    </Toast>
  );
}

const Toast = styled(motion.div)`
  display: flex;
  align-items: center;
  height: 40px;
  max-width: calc(100vw - ${space(4)} * 2);
  padding: 0 15px 0 10px;
  margin-top: 15px;
  background: ${p => p.theme.inverted.background};
  color: ${p => p.theme.inverted.textColor};
  border-radius: 44px 7px 7px 44px;
  box-shadow: ${p => p.theme.dropShadowHeavy};
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

const Icon = styled('div', {shouldForwardProp: p => p !== 'type'})<{type: string}>`
  margin-right: ${space(0.75)};
  svg {
    display: block;
  }

  color: ${p => (p.type === 'success' ? p.theme.successText : p.theme.errorText)};
`;

const Message = styled('div')`
  flex: 1;
  ${p => p.theme.overflowEllipsis}
`;

const Undo = styled(Button)`
  color: ${p => p.theme.inverted.linkColor};
  margin-left: ${space(2)};

  &:hover {
    color: ${p => p.theme.inverted.linkHoverColor};
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  .loading-indicator {
    border-color: ${p => p.theme.inverted.border};
    border-left-color: ${p => p.theme.inverted.purple300};
  }
`;

export default ToastIndicator;
