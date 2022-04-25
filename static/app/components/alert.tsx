import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {Theme} from 'sentry/utils/theme';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  expand?: React.ReactNode;
  opaque?: boolean;
  showIcon?: boolean;
  system?: boolean;
  trailingItems?: React.ReactNode;
  type?: keyof Theme['alert'];
}

const DEFAULT_TYPE = 'info';

const IconWrapper = styled('div')`
  display: flex;
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  margin-right: ${space(1)};
  align-items: center;
`;

const ContentWrapper = styled('div')`
  width: 100%;
`;

const TrailingItems = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: 100%;
  align-items: center;
  gap: ${space(1)};
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  margin-left: ${space(1)};
`;

const alertStyles = ({
  theme,
  type = DEFAULT_TYPE,
  trailingItems,
  system,
  opaque,
  expand,
}: AlertProps & {theme: Theme}) => {
  const alertColors = theme.alert[type] ?? theme.alert[DEFAULT_TYPE];

  return css`
    display: flex;
    margin: 0 0 ${space(2)};
    padding: ${space(1.5)} ${space(2)};
    font-size: ${theme.fontSizeMedium};
    border-radius: ${theme.borderRadius};
    border: 1px solid ${alertColors.border};
    background: ${opaque
      ? `linear-gradient(${alertColors.backgroundLight}, ${alertColors.backgroundLight}), linear-gradient(${theme.background}, ${theme.background})`
      : `${alertColors.backgroundLight}`};

    ${defined(trailingItems) && `padding-right: ${space(1.5)};`}

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

    ${IconWrapper} {
      color: ${alertColors.iconColor};
    }

    ${expand &&
    `
      cursor: pointer;
      &:hover {
        border-color: ${alertColors.borderHover}
      }
      &:hover ${IconWrapper} {
        color: ${alertColors.iconHoverColor};
      }
    `}

    ${system &&
    `
      border-width: 0 0 1px 0;
      border-radius: 0;
    `}
  `;
};

const StyledTextBlock = styled('span')`
  line-height: ${p => p.theme.text.lineHeightBody};
  position: relative;
  flex: 1;
`;

const MessageContainer = styled('div')`
  display: flex;
  width: 100%;
`;

const ExpandContainer = styled('div')`
  display: grid;
  padding-top: ${space(1)};
`;

const ExpandIcon = styled(props => (
  <IconWrapper {...props}>{<IconChevron />}</IconWrapper>
))`
  transform: ${props => (props.isExpanded ? 'rotate(0deg)' : 'rotate(180deg)')};
  justify-self: flex-end;
`;

const Alert = styled(
  ({
    type,
    children,
    className,
    showIcon = false,
    expand,
    trailingItems,
    opaque: _opaque, // don't forward to `div`
    system: _system, // don't forward to `div`
    ...props
  }: AlertProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const showExpand = defined(expand);
    const showExpandItems = showExpand && isExpanded;

    const getIcon = () => {
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
    };

    return (
      <div
        onClick={() => showExpand && setIsExpanded(!isExpanded)}
        className={classNames(type ? `ref-${type}` : '', className)}
        {...props}
      >
        {showIcon && <IconWrapper>{getIcon()}</IconWrapper>}
        <ContentWrapper>
          <MessageContainer>
            <StyledTextBlock>{children}</StyledTextBlock>
            {(showExpand || defined(trailingItems)) && (
              <TrailingItems>
                {trailingItems}
                {showExpand && <ExpandIcon isExpanded={isExpanded} />}
              </TrailingItems>
            )}
          </MessageContainer>
          {showExpandItems && (
            <ExpandContainer>
              {Array.isArray(expand) ? expand.map(item => item) : expand}
            </ExpandContainer>
          )}
        </ContentWrapper>
      </div>
    );
  }
)<AlertProps>`
  ${alertStyles}
`;

Alert.defaultProps = {
  type: DEFAULT_TYPE,
};

export {alertStyles};

export default Alert;
