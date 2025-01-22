import {useRef, useState} from 'react';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import classNames from 'classnames';

import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultExpanded?: boolean;
  expand?: React.ReactNode;
  icon?: React.ReactNode;
  opaque?: boolean;
  showIcon?: boolean;
  system?: boolean;
  trailingItems?: React.ReactNode;
  type?: keyof Theme['alert'];
}

const DEFAULT_TYPE = 'info';

function Alert({
  type = DEFAULT_TYPE,
  showIcon = false,
  icon,
  opaque,
  system,
  expand,
  defaultExpanded = false,
  trailingItems,
  className,
  children,
  ...props
}: AlertProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const showExpand = defined(expand);
  const showTrailingItems = defined(trailingItems);

  // Show the hover state (with darker borders) only when hovering over the
  // IconWrapper or MessageContainer.
  const {hoverProps, isHovered} = useHover({
    isDisabled: !showExpand,
  });
  const {hoverProps: expandHoverProps, isHovered: expandIsHovered} = useHover({
    isDisabled: !showExpand,
  });

  function getIcon() {
    switch (type) {
      case 'warning':
        return <IconWarning />;
      case 'success':
        return <IconCheckmark />;
      case 'error':
        return <IconNot />;
      case 'info':
      default:
        return <IconInfo />;
    }
  }

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

  return (
    <Wrap
      type={type}
      system={system}
      opaque={opaque}
      expand={expand}
      trailingItems={trailingItems}
      showIcon={showIcon}
      onClick={handleClick}
      hovered={isHovered && !expandIsHovered}
      className={classNames(type ? `ref-${type}` : '', className)}
      {...hoverProps}
      {...props}
    >
      <PanelProvider>
        {showIcon && <IconWrapper onClick={handleClick}>{icon ?? getIcon()}</IconWrapper>}
        <Message>{children}</Message>
        {showTrailingItems && (
          <TrailingItems showIcon={showIcon} onClick={e => e.stopPropagation()}>
            {trailingItems}
          </TrailingItems>
        )}
        {showExpand && (
          <ExpandIconWrap>
            <IconChevron direction={isExpanded ? 'up' : 'down'} />
          </ExpandIconWrap>
        )}
        {isExpanded && (
          <ExpandContainer
            ref={expandRef}
            showIcon={showIcon}
            showTrailingItems={showTrailingItems}
            {...expandHoverProps}
          >
            {Array.isArray(expand) ? expand.map(item => item) : expand}
          </ExpandContainer>
        )}
      </PanelProvider>
    </Wrap>
  );
}

const alertStyles = ({
  type = DEFAULT_TYPE,
  system,
  opaque,
  expand,
  showIcon,
  trailingItems,
  hovered,
  theme,
}: AlertProps & {theme: Theme; hovered?: boolean}) => {
  const alertColors = theme.alert[type];
  const showExpand = defined(expand);
  const showTrailingItems = defined(trailingItems);

  return css`
    display: grid;
    grid-template-columns:
      ${showIcon && `minmax(0, max-content)`}
      minmax(0, 1fr)
      ${showTrailingItems && 'max-content'}
      ${showExpand && 'max-content'};
    gap: ${space(1)};
    margin: 0 0 ${space(2)};
    color: ${alertColors.color};
    font-size: ${theme.fontSizeMedium};
    border-radius: ${theme.borderRadius};
    border: 1px solid ${alertColors.border};
    background: ${opaque
      ? `linear-gradient(
          ${alertColors.backgroundLight},
          ${alertColors.backgroundLight}),
          linear-gradient(${theme.background}, ${theme.background}
        )`
      : `${alertColors.backgroundLight}`};

    a:not([role='button']) {
      color: ${alertColors.color};
      text-decoration-color: ${alertColors.border};
      text-decoration-style: solid;
      text-decoration-line: underline;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.06em;
    }
    a:not([role='button']):hover {
      text-decoration-color: ${alertColors.color};
      text-decoration-style: solid;
    }

    pre {
      background: ${alertColors.backgroundLight};
      margin: ${space(0.5)} 0 0;
    }

    ${hovered && `border-color: ${alertColors.borderHover};`}

    ${showExpand &&
    `cursor: pointer;
      ${TrailingItems} {
       cursor: auto;
      }
    `}

    ${system &&
    `
      border-width: 0 0 1px 0;
      border-radius: 0;
    `}
  `;
};

const Wrap = styled('div')<AlertProps & {hovered: boolean}>`
  ${alertStyles}
  padding: ${space(1.5)} ${space(2)};
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
`;

const Message = styled('span')`
  position: relative;
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const TrailingItems = styled('div')<{showIcon: boolean}>`
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 100%;
  align-items: center;
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    /* In mobile, TrailingItems should wrap to a second row and be vertically aligned
    with Message. When there is a leading icon, Message is in the second grid column.
    Otherwise it's in the first grid column. */
    grid-row: 2;
    grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
    justify-items: start;
    margin: ${space(0.5)} 0;
  }
`;

const ExpandIconWrap = styled(IconWrapper)`
  margin-left: ${space(0.5)};
`;

const ExpandContainer = styled('div')<{showIcon: boolean; showTrailingItems: boolean}>`
  grid-row: 2;
  /* ExpandContainer should be vertically aligned with Message. When there is a leading icon,
  Message is in the second grid column. Otherwise it's in the first column. */
  grid-column: ${p => (p.showIcon ? 2 : 1)} / -1;
  cursor: auto;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-row: ${p => (p.showTrailingItems ? 3 : 2)};
  }
`;

export {Alert, alertStyles};

export default Alert;
