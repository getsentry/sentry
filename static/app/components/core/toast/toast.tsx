import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import classNames from 'classnames';
import {motion} from 'framer-motion';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCheckmark, IconRefresh, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import {withChonk} from 'sentry/utils/theme/withChonk';

import {
  ChonkToastContainer,
  ChonkToastIconContainer,
  ChonkToastLoadingIndicator,
  ChonkToastMessage,
  ChonkToastUndoButton,
  ChonkToastUndoButtonContainer,
} from './toast.chonk';

export interface ToastProps {
  indicator: Indicator;
  onDismiss: (indicator: Indicator, event: React.MouseEvent) => void;
}

export function Toast({indicator, onDismiss, ...props}: ToastProps) {
  const theme = useTheme();

  return (
    <ToastContainer
      onClick={
        indicator.options?.disableDismiss ? undefined : e => onDismiss(indicator, e)
      }
      data-test-id={indicator.type ? `toast-${indicator.type}` : 'toast'}
      className={classNames('ref-toast', `ref-${indicator.type}`)}
      type={indicator.type}
      {...TOAST_TRANSITION}
      {...props}
    >
      <ToastIcon type={indicator.type} />
      <ToastMessage>
        <TextOverflow>{indicator.message}</TextOverflow>
      </ToastMessage>
      {indicator.options.undo && typeof indicator.options.undo === 'function' ? (
        <ToastUndoButtonContainer type={indicator.type}>
          <ToastUndoButton
            priority={theme.isChonk ? 'default' : 'link'}
            size={theme.isChonk ? 'xs' : undefined}
            onClick={indicator.options.undo}
            icon={<IconRefresh size="xs" />}
          >
            {t('Undo')}
          </ToastUndoButton>
        </ToastUndoButtonContainer>
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
      return (
        <ToastIconContainer type={type}>
          <ToastLoadingIndicator size={16} />
        </ToastIconContainer>
      );
    case 'success':
      return (
        <ToastIconContainer type={type}>
          <IconCheckmark />
        </ToastIconContainer>
      );
    case 'error':
      return (
        <ToastIconContainer type={type}>
          <IconWarning />
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

const ToastContainer = withChonk(
  styled(motion.div)<React.HTMLAttributes<HTMLDivElement> & {type: Indicator['type']}>`
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
  `,
  ChonkToastContainer
);

const ToastIconContainer = withChonk(
  styled('div')<{type: Indicator['type']}>`
    margin-right: ${space(0.75)};

    svg {
      width: 16px;
      height: 16px;
      color: ${p =>
        p.type === 'success'
          ? p.theme.successText
          : p.type === 'error'
            ? p.theme.errorText
            : p.theme.textColor};
    }
  `,
  ChonkToastIconContainer
);

const ToastMessage = withChonk(
  styled('div')`
    flex: 1;
  `,
  ChonkToastMessage
);

const ToastUndoButton = withChonk(
  styled(Button)`
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
    color: ${p => p.theme.inverted.linkColor};
    margin-left: ${space(2)};

    &:hover {
      color: ${p => p.theme.inverted.linkHoverColor};
    }
  `,
  ChonkToastUndoButton
);

const ToastUndoButtonContainer = withChonk(
  styled('div')<{type: Indicator['type']}>`
    color: ${p => p.theme.inverted.linkColor};

    &:hover {
      color: ${p => p.theme.inverted.linkHoverColor};
    }
  `,
  ChonkToastUndoButtonContainer
);

const ToastLoadingIndicator = withChonk(
  styled(LoadingIndicator)`
    margin: 0;

    .loading-indicator {
      border-color: ${p => p.theme.inverted.border};
      border-left-color: ${p => p.theme.inverted.purple300};
    }
  `,
  ChonkToastLoadingIndicator
);
