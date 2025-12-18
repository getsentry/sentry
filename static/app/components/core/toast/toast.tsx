import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import classNames from 'classnames';
import {motion, type HTMLMotionProps} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {chonkFor} from 'sentry/components/core/chonk';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconCheckmark, IconRefresh, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import type {Theme} from 'sentry/utils/theme';

export interface ToastProps {
  indicator: Indicator;
  onDismiss: (indicator: Indicator, event: React.MouseEvent) => void;
}

export function Toast({indicator, onDismiss, ...props}: ToastProps) {
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
      <Container padding="lg">
        <TextOverflow>{indicator.message}</TextOverflow>
      </Container>
      {indicator.options.undo && typeof indicator.options.undo === 'function' ? (
        <Flex align="center" justify="center" padding="0 lg">
          <Button
            priority="default"
            size="xs"
            onClick={indicator.options.undo}
            icon={<IconRefresh size="xs" />}
          >
            {t('Undo')}
          </Button>
        </Flex>
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

function getContainerTheme(theme: Theme, type: Indicator['type']): React.CSSProperties {
  switch (type) {
    case 'success':
      return {
        background: theme.colors.green100,
        borderBottom: `2px solid ${theme.tokens.border.success}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.green400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.green400)}`,
      };
    case 'error':
      return {
        background: theme.colors.red100,
        borderBottom: `2px solid ${theme.tokens.border.danger}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.red400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.red400)}`,
      };
    default:
      return {
        background: theme.tokens.background.primary,
        borderBottom: `2px solid ${theme.tokens.border.accent}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.blue400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.blue400)}`,
      };
  }
}

interface ChonkToastContainerProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  type: Indicator['type'];
}

const ToastContainer = styled((props: ChonkToastContainerProps) => {
  const {type, children, ...rest} = props;
  return (
    <ToastOuterContainer type={type} {...rest}>
      <ToastInnerContainer type={type}>{children}</ToastInnerContainer>
    </ToastOuterContainer>
  );
})<ChonkToastContainerProps>``;

const ToastOuterContainer = styled(motion.div)<{type: Indicator['type']}>`
  overflow: hidden;
  /* The outer container is a separate element because the colors are not opaque,
   * so we set the background color here to the background color so that the
   * toast is not see-through.
   */
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.lg};
  border: ${p => getContainerTheme(p.theme, p.type).border};
  box-shadow: ${p => getContainerTheme(p.theme, p.type).boxShadow};
`;

const ToastInnerContainer = styled('div')<{type: Indicator['type']}>`
  display: flex;
  align-items: stretch;
  background: ${p => getContainerTheme(p.theme, p.type).background};
`;

function getToastIconContainerTheme(
  theme: Theme,
  type: Indicator['type']
): React.CSSProperties {
  switch (type) {
    case 'success':
      return {
        background: theme.colors.chonk.green400,
        borderRight: `1px solid ${chonkFor(theme, theme.colors.chonk.green400)}`,
      };
    case 'error':
      return {
        background: theme.colors.chonk.red400,
        borderRight: `1px solid ${chonkFor(theme, theme.colors.chonk.red400)}`,
      };
    default:
      return {
        background: theme.tokens.background.primary,
        borderRight: `1px solid ${chonkFor(theme, theme.colors.chonk.blue400)}`,
      };
  }
}
const ToastIconContainer = styled('div')<{type: Indicator['type']}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  position: relative;
  ${p => ({...getToastIconContainerTheme(p.theme, p.type)})};

  svg {
    width: 16px;
    height: 16px;
    color: ${p =>
      p.type === 'success'
        ? p.theme.colors.black
        : p.type === 'error'
          ? p.theme.colors.white
          : undefined} !important;
  }
`;

const ToastLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
