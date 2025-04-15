import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import classNames from 'classnames';
import {motion} from 'framer-motion';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

type Props = {
  indicator: Indicator;
  onDismiss: (indicator: Indicator, event: React.MouseEvent) => void;
  className?: string;
};

const TOAST_TRANSITION = {
  initial: {opacity: 0, y: 70},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 70},
  transition: testableTransition({
    type: 'spring',
    stiffness: 450,
    damping: 25,
  }),
};

export function ToastIndicator({indicator, onDismiss, className, ...props}: Props) {
  return (
    <Toast
      onClick={
        indicator.options?.disableDismiss ? undefined : e => onDismiss(indicator, e)
      }
      data-test-id={indicator.type ? `toast-${indicator.type}` : 'toast'}
      className={classNames(className, 'ref-toast', `ref-${indicator.type}`)}
      {...TOAST_TRANSITION}
      {...props}
    >
      <ToastIcon type={indicator.type} />
      <Message>
        <TextOverflow>{indicator.message}</TextOverflow>
      </Message>
      {typeof indicator.options?.undo === 'function' && (
        <Undo priority="link" onClick={indicator.options.undo}>
          {t('Undo')}
        </Undo>
      )}
    </Toast>
  );
}

function ToastIcon({type}: {type: Indicator['type']}) {
  switch (type) {
    case 'loading':
      return <StyledLoadingIndicator mini />;
    case 'success':
      return (
        <IconContainer type={type}>
          <IconCheckmark size="lg" isCircled />
        </IconContainer>
      );
    case 'error':
      return (
        <IconContainer type={type}>
          <IconClose size="lg" isCircled />
        </IconContainer>
      );
    case 'undo':
      return null;
    case '':
      return null;
    default:
      Sentry.captureException(new Error(`Unknown toast type: ${type}`));
      return null;
  }
}

const Toast = styled(motion.div)<React.HTMLAttributes<HTMLDivElement>>`
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

const IconContainer = styled('div', {shouldForwardProp: p => p !== 'type'})<{
  type: string;
}>`
  margin-right: ${space(0.75)};
  svg {
    display: block;
  }

  color: ${p => (p.type === 'success' ? p.theme.successText : p.theme.errorText)};
`;

const Message = styled('div')`
  flex: 1;
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
