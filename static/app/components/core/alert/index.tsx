import {Fragment, useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import classNames from 'classnames';

import {Button} from 'sentry/components/core/button';
import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkAlert from './index.chonk';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'muted' | 'info' | 'warning' | 'success' | 'error';
  defaultExpanded?: boolean;
  expand?: React.ReactNode;
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
    }
  }

  const showIcon = props.showIcon ?? true;

  return (
    <AlertContainer
      system={system}
      expand={expand}
      trailingItems={trailingItems}
      showIcon={showIcon as false}
      onClick={handleClick}
      hovered={isHovered && !expandIsHovered}
      className={classNames(type ? `ref-${type}` : '', className)}
      type={type}
      {...hoverProps}
      {...props}
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
              onClick={() => setIsExpanded(!isExpanded)}
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
        background: theme.gray200,
        backgroundLight: theme.backgroundSecondary,
        border: theme.border,
        borderHover: theme.border,
        color: 'inherit',
      };
    case 'info':
      return {
        background: theme.blue300,
        backgroundLight: theme.blue100,
        border: theme.blue200,
        borderHover: theme.blue300,
        color: theme.blue400,
      };
    case 'warning':
      return {
        background: theme.yellow300,
        backgroundLight: theme.yellow100,
        border: theme.yellow200,
        borderHover: theme.yellow300,
        color: theme.yellow400,
      };
    case 'success':
      return {
        background: theme.green300,
        backgroundLight: theme.green100,
        border: theme.green200,
        borderHover: theme.green300,
        color: theme.green400,
      };
    case 'error':
      return {
        background: theme.red300,
        backgroundLight: theme.red100,
        border: theme.red200,
        borderHover: theme.red300,
        color: theme.red400,
      };
    default:
      unreachable(type);
  }

  throw new Error(`Invalid alert type, got ${type}`);
}

function getAlertGridLayout(p: AlertProps) {
  if (p.showIcon) {
    return `min-content 1fr ${p.trailingItems ? 'min-content' : ''} ${
      p.expand ? 'min-content' : ''
    }`;
  }

  return `1fr ${p.trailingItems ? 'min-content' : ''} ${p.expand ? 'min-content' : ''}`;
}

const AlertPanel = styled('div')<AlertProps & {hovered: boolean}>`
  display: grid;
  grid-template-columns: ${p => getAlertGridLayout(p)};
  gap: ${space(1)};
  color: ${p => getAlertColors(p.theme, p.type).color};
  font-size: ${p => p.theme.fontSize.md};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => getAlertColors(p.theme, p.type).border};
  padding: ${space(1.5)} ${space(2)};
  background: ${p => getAlertColors(p.theme, p.type).backgroundLight};

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

const IconWrapper = withChonk(
  styled('div')<{type: AlertProps['type']}>`
    display: flex;
    align-items: center;
    height: calc(${p => p.theme.fontSize.md} * ${p => p.theme.text.lineHeightBody});
  `,
  ChonkAlert.IconWrapper
);

const Message = withChonk(
  styled('span')`
    position: relative;
    line-height: ${p => p.theme.text.lineHeightBody};
  `,
  ChonkAlert.Message
);

const TrailingItems = withChonk(
  styled('div')<{showIcon: boolean}>`
    height: calc(${p => p.theme.fontSize.md} * ${p => p.theme.text.lineHeightBody});
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: 100%;
    align-items: center;
    gap: ${space(1)};

    @media (max-width: ${p => p.theme.breakpoints.sm}) {
      /* In mobile, TrailingItems should wrap to a second row and be vertically aligned
    with Message. When there is a leading icon, Message is in the second grid column.
    Otherwise it's in the first grid column. */
      grid-row: 2;
      grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
      justify-items: start;
      margin: ${space(0.5)} 0;
    }
  `,
  ChonkAlert.TrailingItems
);

const ExpandIconWrap = withChonk(
  styled('div')`
    display: flex;
    align-items: center;
    margin-left: ${space(0.5)};
  `,
  ChonkAlert.ExpandIconWrap
);

const ExpandContainer = withChonk(
  styled('div')<{showIcon: boolean; showTrailingItems: boolean}>`
    grid-row: 2;
    /* ExpandContainer should be vertically aligned with Message. When there is a leading icon,
  Message is in the second grid column. Otherwise it's in the first column. */
    grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
    cursor: auto;

    @media (max-width: ${p => p.theme.breakpoints.sm}) {
      grid-row: ${p => (p.showTrailingItems ? 3 : 2)};
    }
  `,
  ChonkAlert.ExpandContainer
);

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
