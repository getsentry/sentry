import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  expand?: React.ReactNode[];
  opaque?: boolean;
  showIcon?: boolean;
  system?: boolean;
  type?: keyof Theme['alert'];
}

const DEFAULT_TYPE = 'info';

const IconWrapper = styled('span')`
  display: flex;
  height: calc(${p => p.theme.fontSizeMedium} * ${p => p.theme.text.lineHeightBody});
  margin-right: ${space(1)};
  align-items: center;
`;

const alertStyles = ({
  theme,
  type = DEFAULT_TYPE,
  system,
  opaque,
  expand,
}: AlertProps & {theme: Theme}) => {
  const alertColors = theme.alert[type] ?? theme.alert[DEFAULT_TYPE];

  return css`
    display: flex;
    flex-direction: column;
    margin: 0 0 ${space(2)};
    padding: ${space(1.5)} ${space(2)};
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
  grid-template-columns: minmax(${space(4)}, 1fr) 30fr 1fr;
  grid-template-areas: '. details details';
  padding-top: ${space(1.5)};
`;
const DetailsContainer = styled('div')`
  grid-area: details;
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
    opaque: _opaque, // don't forward to `div`
    system: _system, // don't forward to `div`
    ...props
  }: AlertProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const showExpand = expand && expand.length;
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
        <MessageContainer>
          {showIcon && <IconWrapper>{getIcon()}</IconWrapper>}
          <StyledTextBlock>{children}</StyledTextBlock>
          {showExpand && <ExpandIcon isExpanded={isExpanded} />}
        </MessageContainer>
        {showExpandItems && (
          <ExpandContainer>
            <DetailsContainer>{(expand || []).map(item => item)}</DetailsContainer>
          </ExpandContainer>
        )}
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
