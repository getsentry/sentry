import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {type HTMLMotionProps, motion} from 'framer-motion';

import type {Indicator} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {chonkFor} from 'sentry/components/core/chonk';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

function getChonkContainerTheme(
  theme: DO_NOT_USE_ChonkTheme,
  type: Indicator['type']
): React.CSSProperties {
  switch (type) {
    case 'success':
      return {
        background: theme.colors.green100,
        borderBottom: `2px solid ${theme.colors.border.success}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.green400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.green400)}`,
      };
    case 'error':
      return {
        background: theme.colors.red100,
        borderBottom: `2px solid ${theme.colors.border.danger}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.red400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.red400)}`,
      };
    default:
      return {
        background: theme.colors.background.primary,
        borderBottom: `2px solid ${theme.colors.border.accent}`,
        border: `1px solid ${chonkFor(theme, theme.colors.chonk.blue400)}`,
        boxShadow: `0 3px 0 0px ${chonkFor(theme, theme.colors.chonk.blue400)}`,
      };
  }
}

interface ChonkToastContainerProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  type: Indicator['type'];
}

export const ChonkToastContainer = chonkStyled((props: ChonkToastContainerProps) => {
  const {type, children, ...rest} = props;
  return (
    <ChonkToastOuterContainer type={type} {...rest}>
      <ChonkToastInnerContainer type={type}>{children}</ChonkToastInnerContainer>
    </ChonkToastOuterContainer>
  );
})<ChonkToastContainerProps>``;

const ChonkToastOuterContainer = chonkStyled(motion.div)<{type: Indicator['type']}>`
  overflow: hidden;
  /* The outer container is a separate element because the colors are not opaque,
   * so we set the background color here to the background color so that the
   * toast is not see-through.
   */
  background: ${p => p.theme.colors.background.primary};
  border-radius: ${p => p.theme.radius.lg};
  border: ${p => getChonkContainerTheme(p.theme, p.type).border};
  box-shadow: ${p => getChonkContainerTheme(p.theme, p.type).boxShadow};
`;

const ChonkToastInnerContainer = chonkStyled('div')<{type: Indicator['type']}>`
  display: flex;
  align-items: stretch;
  background: ${p => getChonkContainerTheme(p.theme, p.type).background};
`;

export const ChonkToastMessage = chonkStyled('div')`
  padding: ${p => p.theme.space.lg};
`;

function getChonkToastIconContainerTheme(
  theme: DO_NOT_USE_ChonkTheme,
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
        background: theme.colors.background.primary,
        borderRight: `1px solid ${chonkFor(theme, theme.colors.chonk.blue400)}`,
      };
  }
}
export const ChonkToastIconContainer = chonkStyled('div')<{type: Indicator['type']}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  position: relative;
  ${p => ({...getChonkToastIconContainerTheme(p.theme, p.type)})};

  svg {
    width: 16px;
    height: 16px;
    color: ${p => (p.type === 'success' ? p.theme.colors.black : p.type === 'error' ? p.theme.colors.white : undefined)} !important;
`;

export const ChonkToastLoadingIndicator = chonkStyled(LoadingIndicator)`
  margin: 0;
  .loading-indicator {

  }
`;

export const ChonkToastUndoButton = chonkStyled(Button)`
`;

export const ChonkToastUndoButtonContainer = chonkStyled('div')<{
  type: Indicator['type'];
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${p => p.theme.space.lg};
`;
