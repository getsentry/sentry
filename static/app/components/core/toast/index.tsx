import {useEffect} from 'react';
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

interface ToastProps {
  indicator: Indicator;
  onDismiss: (indicator: Indicator, event: React.MouseEvent) => void;
}

export function Toast({indicator, onDismiss, ...props}: ToastProps) {
  // The types are allowing us to render an undo toast without an undo function, which defeats the purpose
  // of an undo toast. Log these to Sentry so we can fix the issue.
  useEffect(() => {
    if (indicator.type === 'undo' && !indicator.options?.undo) {
      Sentry.logger.error(
        'Rendered undo toast without undo function, this should not happen.',
        {
          toast:
            typeof indicator.message === 'string'
              ? indicator.message
              : '<Unknown React Node />',
        }
      );
    }
  }, [indicator]);

  return (
    <ToastContainer
      onClick={
        indicator.options?.disableDismiss ? undefined : e => onDismiss(indicator, e)
      }
      data-test-id={indicator.type ? `toast-${indicator.type}` : 'toast'}
      className={classNames('ref-toast', `ref-${indicator.type}`)}
      {...TOAST_TRANSITION}
      {...props}
    >
      <ToastIcon type={indicator.type} />
      <ToastMessage>
        <TextOverflow>{indicator.message}</TextOverflow>
      </ToastMessage>
      {typeof indicator.options?.undo === 'function' ? (
        <ToastUndoButton priority="link" onClick={indicator.options.undo}>
          {t('Undo')}
        </ToastUndoButton>
      ) : null}
    </ToastContainer>
  );
}

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

function ToastIcon({type}: {type: Indicator['type']}) {
  switch (type) {
    case 'loading':
      return <ToastLoadingIndicator mini />;
    case 'success':
      return (
        <ToastIconContainer>
          <IconCheckmark size="lg" isCircled color="successText" />
        </ToastIconContainer>
      );
    case 'error':
      return (
        <ToastIconContainer>
          <IconClose size="lg" isCircled color="errorText" />
        </ToastIconContainer>
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

const ToastContainer = styled(motion.div)<React.HTMLAttributes<HTMLDivElement>>`
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

const ToastIconContainer = styled('div')`
  margin-right: ${space(0.75)};
  svg {
    display: block;
  }
`;

const ToastMessage = styled('div')`
  flex: 1;
`;

const ToastUndoButton = styled(Button)`
  color: ${p => p.theme.inverted.linkColor};
  margin-left: ${space(2)};

  &:hover {
    color: ${p => p.theme.inverted.linkHoverColor};
  }
`;

const ToastLoadingIndicator = styled(LoadingIndicator)`
  .loading-indicator {
    border-color: ${p => p.theme.inverted.border};
    border-left-color: ${p => p.theme.inverted.purple300};
  }
`;
