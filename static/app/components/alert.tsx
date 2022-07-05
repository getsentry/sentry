import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import classNames from 'classnames';

import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {Theme} from 'sentry/utils/theme';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
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
  trailingItems,
  className,
  children,
  ...props
}: AlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showExpand = defined(expand);
  const showTrailingItems = defined(trailingItems);

  // Show the hover state (with darker borders) only when hovering over the
  // IconWrapper or MessageContainer.
  const {hoverProps: iconHoverProps, isHovered: iconIsHovered} = useHover({
    isDisabled: !showExpand,
  });
  const {hoverProps: messageHoverProps, isHovered: messageIsHovered} = useHover({
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

  function handleClick() {
    showExpand && setIsExpanded(!isExpanded);
  }

  return (
    <Wrap
      type={type}
      system={system}
      opaque={opaque}
      expand={expand}
      hovered={iconIsHovered || messageIsHovered}
      className={classNames(type ? `ref-${type}` : '', className)}
      {...props}
    >
      {showIcon && (
        <IconWrapper onClick={handleClick} {...iconHoverProps}>
          {icon ?? getIcon()}
        </IconWrapper>
      )}
      <ContentWrapper>
        <MessageContainer
          onClick={handleClick}
          showIcon={showIcon}
          showTrailingItems={showTrailingItems}
          {...messageHoverProps}
        >
          <Message>{children}</Message>
          {(showExpand || showTrailingItems) && (
            <TrailingItemsWrap>
              <TrailingItems onClick={e => e.stopPropagation()}>
                {trailingItems}
              </TrailingItems>
              {showExpand && (
                <ExpandIconWrap>
                  <IconChevron direction={isExpanded ? 'up' : 'down'} />
                </ExpandIconWrap>
              )}
            </TrailingItemsWrap>
          )}
        </MessageContainer>
        {isExpanded && (
          <ExpandContainer>
            {Array.isArray(expand) ? expand.map(item => item) : expand}
          </ExpandContainer>
        )}
      </ContentWrapper>
    </Wrap>
  );
}

const alertStyles = ({
  type = DEFAULT_TYPE,
  system,
  opaque,
  expand,
  hovered,
  theme,
}: AlertProps & {theme: Theme; hovered?: boolean}) => {
  const alertColors = theme.alert[type];
  const showExpand = defined(expand);

  return css`
    display: flex;
    margin: 0 0 ${space(2)};
    font-size: ${theme.fontSizeMedium};
    border-radius: ${theme.borderRadius};
    border: 1px solid ${alertColors.border};
    background: ${opaque
      ? `linear-gradient(${alertColors.backgroundLight}, ${alertColors.backgroundLight}), linear-gradient(${theme.background}, ${theme.background})`
      : `${alertColors.backgroundLight}`};

    a:not([role='button']) {
      color: ${theme.textColor};
      text-decoration-color: ${theme.translucentBorder};
      text-decoration-style: solid;
      text-decoration-line: underline;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.06em;
    }
    a:not([role='button']):hover {
      text-decoration-color: ${theme.subText};
      text-decoration-style: solid;
    }

    pre {
      background: ${alertColors.backgroundLight};
      margin: ${space(0.5)} 0 0;
    }

    ${IconWrapper}, ${ExpandIconWrap} {
      color: ${alertColors.iconColor};
    }

    ${hovered &&
    `
      border-color: ${alertColors.borderHover};
      ${IconWrapper}, ${IconChevron} {
        color: ${alertColors.iconHoverColor};
      }
    `}

    ${showExpand &&
    `${IconWrapper}, ${MessageContainer} {
        cursor: pointer;
      }
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
`;

const IconWrapper = styled('div')`
  display: flex;
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  padding: ${space(1.5)} ${space(1)} ${space(1.5)} ${space(2)};
  box-sizing: content-box;
  align-items: center;
`;

const ContentWrapper = styled('div')`
  width: 100%;
`;

const MessageContainer = styled('div')<{
  showIcon: boolean;
  showTrailingItems: boolean;
}>`
  display: flex;
  width: 100%;
  padding-top: ${space(1.5)};
  padding-bottom: ${space(1.5)};
  padding-left: ${p => (p.showIcon ? '0' : space(2))};
  padding-right: ${p => (p.showTrailingItems ? space(1.5) : space(2))};
`;

const Message = styled('span')`
  line-height: ${p => p.theme.text.lineHeightBody};
  position: relative;
  flex: 1;
`;

const TrailingItems = styled('div')`
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 100%;
  align-items: center;
  gap: ${space(1)};
`;

const TrailingItemsWrap = styled(TrailingItems)`
  margin-left: ${space(1)};
`;

const ExpandIconWrap = styled('div')`
  height: 100%;
  display: flex;
  align-items: center;
`;

const ExpandContainer = styled('div')`
  display: grid;
  padding-right: ${space(1.5)};
  padding-bottom: ${space(1.5)};
`;

export {alertStyles};

export default Alert;
