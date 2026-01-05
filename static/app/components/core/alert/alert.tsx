import {Fragment, useRef, useState} from 'react';
import type {SerializedStyles, Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {DistributedOmit} from 'type-fest';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import type {AlertVariant} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: AlertVariant;
  defaultExpanded?: boolean;
  expand?: React.ReactNode;
  handleExpandChange?: (isExpanded: boolean) => void;
  icon?: React.ReactNode;
  showIcon?: boolean;
  system?: boolean;
  trailingItems?: React.ReactNode;
}

const AlertPanel = styled('div')<AlertProps>`
  position: relative;
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-width: ${p => (p.system ? '0px 0px 1px 0px' : '1px')};
  border-style: solid;
  border-radius: ${p => (p.system ? '0px' : p.theme.radius.md)};
  cursor: ${p => (p.expand ? 'pointer' : 'inherit')};
  gap: ${p => p.theme.space.lg};
  row-gap: 0;
  overflow: hidden;
  min-height: 44px;
  ${props => makeAlertTheme(props, props.theme)};

  a:not([role='button']) {
    text-decoration: underline;
  }
`;

function getAlertGridLayout(p: AlertProps) {
  return `1fr ${p.trailingItems ? 'auto' : ''} ${p.expand ? 'min-content' : ''}`;
}

function makeAlertTheme(props: AlertProps, theme: Theme): SerializedStyles {
  const tokens = getAlertTokens(props.variant, theme);
  return css`
    ${generateAlertBackground(props, tokens, theme)};
    border-color: ${tokens.border};

    /* We dont want to override the color of any elements inside buttons */
    :not(button *) {
      color: ${theme.tokens.content.primary};
    }
  `;
}

function getAlertTokens(variant: AlertProps['variant'], theme: Theme) {
  switch (variant) {
    case 'info':
      return {
        background: theme.colors.blue100,
        iconBackground: theme.colors.chonk.blue400,
        border: theme.tokens.border.accent,
      };
    case 'danger':
      return {
        background: theme.colors.red100,
        iconBackground: theme.colors.chonk.red400,
        border: theme.tokens.border.danger,
      };
    case 'warning':
      return {
        background: theme.colors.yellow100,
        iconBackground: theme.colors.chonk.yellow400,
        border: theme.tokens.border.warning,
      };
    case 'success':
      return {
        background: theme.colors.green100,
        iconBackground: theme.colors.chonk.green400,
        border: theme.tokens.border.success,
      };
    case 'muted':
      return {
        background: theme.colors.surface500,
        iconBackground: theme.colors.surface500,
        border: theme.tokens.border.primary,
      };
    default:
      unreachable(variant);
  }

  throw new TypeError(`Invalid alert variant, got ${variant}`);
}

function generateAlertBackground(
  props: AlertProps,
  tokens: ReturnType<typeof getAlertTokens>,
  theme: Theme
) {
  const width = 44;
  if (props.showIcon) {
    return css`
      background-image:
        linear-gradient(
          to right,
          ${tokens.iconBackground},
          ${tokens.iconBackground} ${width - 1}px,
          ${tokens.iconBackground} ${width - 1}px,
          ${tokens.border} ${width - 1}px,
          ${tokens.border} ${width}px,
          ${tokens.background} ${width}px,
          ${tokens.background} ${width + 1}px
        ),
        linear-gradient(${theme.tokens.background.primary});
      padding-left: calc(${width}px + ${theme.space.lg});
    `;
  }
  return css`
    background-image:
      linear-gradient(${tokens.background}),
      linear-gradient(${theme.tokens.background.primary});
  `;
}

const StyledTrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-template-rows: 100%;
  gap: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.md};
  grid-row: 2;
  grid-column: 1 / -1;
  justify-items: start;
  min-height: 28px;
  padding-block: ${p => p.theme.space['2xs']};

  > svg {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    align-self: center;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: auto;
    align-items: start;
  }
`;

const StyledMessage = styled('div')`
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  place-content: center;
  padding-block: ${p => p.theme.space.xs};
`;

const StyledIconWrapper = styled('div')<{variant: AlertProps['variant']}>`
  position: absolute;
  top: ${p => p.theme.space.lg};
  left: ${p => p.theme.space.lg};
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p =>
    ['info', 'danger'].includes(p.variant)
      ? p.theme.colors.white
      : p.variant === 'muted'
        ? p.theme.tokens.content.primary
        : p.theme.colors.black};
`;

const StyledExpandIconWrap = styled('div')`
  display: flex;
  align-items: center;
  align-self: flex-start;
`;

const StyledExpandContainer = styled('div')<{
  showIcon: boolean;
  showTrailingItems: boolean;
}>`
  color: ${p => p.theme.tokens.content.muted};
  grid-row: ${p => (p.showTrailingItems ? 3 : 2)};

  grid-column: 1 / -1;
  align-self: flex-start;
  cursor: auto;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-row: 2;
  }
`;

export function Alert({
  icon,
  system,
  expand,
  trailingItems,
  className,
  children,
  variant,
  ...props
}: AlertProps) {
  const showExpand = defined(expand);
  const [isExpanded, setIsExpanded] = useState(!!props.defaultExpanded);

  const expandRef = useRef<HTMLDivElement>(null);
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (
      // Only close the alert when the click event originated from outside the expanded
      // content.
      e.target === expandRef.current ||
      expandRef.current?.contains(e.target as HTMLDivElement)
    ) {
      return;
    }
    if (showExpand) {
      setIsExpanded(!isExpanded);
      props.handleExpandChange?.(!isExpanded);
    }
  }

  const showIcon = props.showIcon ?? true;

  return (
    <AlertPanel
      system={system}
      expand={expand}
      trailingItems={trailingItems}
      onClick={handleClick}
      className={classNames(variant ? `ref-${variant}` : '', className)}
      variant={variant}
      {...props}
      showIcon={showIcon}
    >
      <PanelProvider>
        {showIcon && (
          <StyledIconWrapper variant={variant} onClick={handleClick}>
            {icon ?? <AlertIcon variant={variant} />}
          </StyledIconWrapper>
        )}
        <StyledMessage>{children}</StyledMessage>
        {!!trailingItems && (
          <StyledTrailingItems onClick={e => e.stopPropagation()}>
            {trailingItems}
          </StyledTrailingItems>
        )}
        {showExpand && (
          <StyledExpandIconWrap>
            <Button
              size="zero"
              borderless
              icon={<IconChevron direction={isExpanded ? 'up' : 'down'} />}
              aria-label={isExpanded ? t('Collapse') : t('Expand')}
              onClick={() => {
                setIsExpanded(!isExpanded);
                props.handleExpandChange?.(!isExpanded);
              }}
            />
          </StyledExpandIconWrap>
        )}
        {isExpanded && (
          <Fragment>
            <StyledExpandContainer
              ref={expandRef}
              showIcon={!!showIcon}
              showTrailingItems={!!trailingItems}
            >
              {Array.isArray(expand) ? expand.map(item => item) : expand}
            </StyledExpandContainer>
          </Fragment>
        )}
      </PanelProvider>
    </AlertPanel>
  );
}

function AlertIcon({variant}: {variant: AlertProps['variant']}): React.ReactNode {
  switch (variant) {
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    case 'danger':
      return <IconNot />;
    case 'info':
    case 'muted':
      return <IconInfo />;
    default:
      unreachable(variant);
  }

  return null;
}

/**
 * Manages margins of Alert components
 */
const Container = styled('div')`
  > div {
    margin-bottom: ${space(2)};
  }
`;

Alert.Container = Container;

function AlertButton(props: DistributedOmit<ButtonProps, 'size'>) {
  return <Button {...props} size="zero" />;
}

Alert.Button = AlertButton;
