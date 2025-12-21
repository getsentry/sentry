import {Fragment, useRef, useState} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import classNames from 'classnames';
import type {DistributedOmit} from 'type-fest';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkAlert from './alert.chonk';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'muted' | 'info' | 'warning' | 'success' | 'error';
  defaultExpanded?: boolean;
  expand?: React.ReactNode;
  handleExpandChange?: (isExpanded: boolean) => void;
  icon?: React.ReactNode;
  showIcon?: boolean;
  system?: boolean;
  trailingItems?: React.ReactNode;
}

export function Alert({
  icon,
  system,
  expand,
  trailingItems,
  className,
  children,
  type,
  ...props
}: AlertProps) {
  const showExpand = defined(expand);
  const [isExpanded, setIsExpanded] = useState(!!props.defaultExpanded);

  // Show the hover state (with darker borders) only when hovering over the
  // IconWrapper or MessageContainer.
  const {hoverProps, isHovered} = useHover({
    isDisabled: !showExpand,
  });
  const {hoverProps: expandHoverProps, isHovered: expandIsHovered} = useHover({
    isDisabled: !showExpand,
  });

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
    <AlertContainer
      system={system}
      expand={expand}
      trailingItems={trailingItems}
      onClick={handleClick}
      hovered={isHovered && !expandIsHovered}
      className={classNames(type ? `ref-${type}` : '', className)}
      type={type}
      {...hoverProps}
      {...props}
      showIcon={showIcon}
    >
      <PanelProvider>
        {showIcon && (
          <IconWrapper type={type} onClick={handleClick}>
            {icon ?? <AlertIcon type={type} />}
          </IconWrapper>
        )}
        <Message>{children}</Message>
        {!!trailingItems && (
          <TrailingItems showIcon={!!showIcon} onClick={e => e.stopPropagation()}>
            {trailingItems}
          </TrailingItems>
        )}
        {showExpand && (
          <ExpandIconWrap>
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
          </ExpandIconWrap>
        )}
        {isExpanded && (
          <Fragment>
            <ExpandContainer
              ref={expandRef}
              showIcon={!!showIcon}
              showTrailingItems={!!trailingItems}
              {...expandHoverProps}
            >
              {Array.isArray(expand) ? expand.map(item => item) : expand}
            </ExpandContainer>
          </Fragment>
        )}
      </PanelProvider>
    </AlertContainer>
  );
}

function getAlertColors(theme: Theme, type: NonNullable<AlertProps['type']>) {
  switch (type) {
    case 'muted':
      return {
        background: theme.colors.gray200,
        backgroundLight: theme.backgroundSecondary,
        border: theme.border,
        borderHover: theme.border,
        color: 'inherit',
      };
    case 'info':
      return {
        background: theme.colors.blue400,
        backgroundLight: theme.colors.blue100,
        border: theme.colors.blue200,
        borderHover: theme.colors.blue400,
        color: theme.colors.blue500,
      };
    case 'warning':
      return {
        background: theme.colors.yellow400,
        backgroundLight: theme.colors.yellow100,
        border: theme.colors.yellow200,
        borderHover: theme.colors.yellow400,
        color: theme.colors.yellow500,
      };
    case 'success':
      return {
        background: theme.colors.green400,
        backgroundLight: theme.colors.green100,
        border: theme.colors.green200,
        borderHover: theme.colors.green400,
        color: theme.colors.green500,
      };
    case 'error':
      return {
        background: theme.colors.red400,
        backgroundLight: theme.colors.red100,
        border: theme.colors.red200,
        borderHover: theme.colors.red400,
        color: theme.colors.red500,
      };
    default:
      unreachable(type);
  }

  throw new Error(`Invalid alert type, got ${type}`);
}

function getAlertGridLayout(p: AlertProps) {
  if (p.showIcon) {
    return `min-content 1fr ${p.trailingItems ? 'auto' : ''} ${
      p.expand ? 'min-content' : ''
    }`;
  }

  return `1fr ${p.trailingItems ? 'auto' : ''} ${p.expand ? 'min-content' : ''}`;
}

const AlertPanel = styled('div')<AlertProps & {hovered: boolean}>`
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};
  gap: ${space(1)};
  color: ${p => getAlertColors(p.theme, p.type).color};
  font-size: ${p => p.theme.font.size.md};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => getAlertColors(p.theme, p.type).border};
  padding: ${space(1.5)} ${space(2)};
  background-image: ${p =>
    `linear-gradient(${getAlertColors(p.theme, p.type).backgroundLight}), linear-gradient(${p.theme.tokens.background.primary})`};

  a:not([role='button']) {
    color: ${p => getAlertColors(p.theme, p.type).color};
    text-decoration-color: ${p => getAlertColors(p.theme, p.type).border};
    text-decoration-style: solid;
    text-decoration-line: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.06em;
  }
  a:not([role='button']):hover {
    text-decoration-color: ${p => getAlertColors(p.theme, p.type).color};
    text-decoration-style: solid;
  }

  pre {
    background: ${p => getAlertColors(p.theme, p.type).backgroundLight};
    margin: ${space(0.5)} 0 0;
  }

  ${p =>
    p.hovered &&
    css`
      border-color: ${getAlertColors(p.theme, p.type).borderHover};
    `}

  ${p =>
    !!p.expand &&
    css`
      cursor: pointer;
      ${TrailingItems} {
        cursor: auto;
      }
    `}

${p =>
    p.system &&
    css`
      border-width: 0 0 1px 0;
      border-radius: 0;
    `}
`;

const AlertContainer = withChonk(
  AlertPanel,
  ChonkAlert.AlertPanel,
  ChonkAlert.chonkAlertPropMapping
);

const IconWrapper = ChonkAlert.IconWrapper;

const Message = ChonkAlert.Message;

const TrailingItems = ChonkAlert.TrailingItems;

const ExpandIconWrap = ChonkAlert.ExpandIconWrap;

const ExpandContainer = ChonkAlert.ExpandContainer;

function AlertIcon({type}: {type: AlertProps['type']}): React.ReactNode {
  switch (type) {
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    case 'error':
      return <IconNot />;
    case 'info':
    case 'muted':
      return <IconInfo />;
    default:
      unreachable(type);
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
