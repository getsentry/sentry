import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {IconChevron} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

export interface AlertProps extends React.HTMLProps<HTMLDivElement> {
  expand?: React.ReactNode[];
  expandIcon?: React.ReactNode;
  icon?: React.ReactNode;
  onExpandIconClick?: () => void;
  opaque?: boolean;
  system?: boolean;
  type?: keyof Theme['alert'];
}

const DEFAULT_TYPE = 'info';

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1)};

  /* Give the wrapper an explicit height so icons are line height with the
   * (common) line height. */
  height: 22px;
  align-items: center;
`;

const alertStyles = ({
  theme,
  type = DEFAULT_TYPE,
  system,
  opaque,
}: AlertProps & {theme: Theme}) => {
  const alertColors = theme.alert[type] ?? theme.alert[DEFAULT_TYPE];

  return css`
    display: flex;
    flex-direction: column;
    margin: 0 0 ${space(2)};
    padding: ${space(1.5)} ${space(2)};
    font-size: ${theme.fontSizeLarge};
    box-shadow: ${theme.dropShadowLight};
    border-radius: ${theme.borderRadius};
    border: 1px solid ${alertColors.border};
    background: ${opaque
      ? `linear-gradient(${alertColors.backgroundLight}, ${alertColors.backgroundLight}), linear-gradient(${theme.background}, ${theme.background})`
      : `${alertColors.backgroundLight}`};

    a:not([role='button']) {
      color: ${theme.textColor};
      border-bottom: 1px dotted ${theme.textColor};
    }

    ${system &&
    `
    border-width: 0 0 1px 0;
    border-radius: 0;
  `}

    ${IconWrapper} {
      color: ${alertColors.iconColor};
    }
  `;
};

const StyledTextBlock = styled('span')`
  line-height: 1.5;
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
  padding: ${space(1.5)} 0;
`;
const DetailsContainer = styled('div')`
  grid-area: details;
`;

const ExpandIcon = styled(props => (
  <IconWrapper {...props}>{<IconChevron size="md" />}</IconWrapper>
))`
  transform: ${props => (props.isExpanded ? 'rotate(0deg)' : 'rotate(180deg)')};
  cursor: pointer;
  justify-self: flex-end;
`;

const Alert = styled(
  ({
    type,
    icon,
    children,
    className,
    expand,
    expandIcon,
    onExpandIconClick,
    opaque: _opaque, // don't forward to `div`
    system: _system, // don't forward to `div`
    ...props
  }: AlertProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const showExpand = expand && expand.length;
    const showExpandItems = showExpand && isExpanded;
    const handleOnExpandIconClick = onExpandIconClick ? onExpandIconClick : setIsExpanded;

    return (
      <div className={classNames(type ? `ref-${type}` : '', className)} {...props}>
        <MessageContainer>
          {icon && <IconWrapper>{icon}</IconWrapper>}
          <StyledTextBlock>{children}</StyledTextBlock>
          {showExpand && (
            <div onClick={() => handleOnExpandIconClick(!isExpanded)}>
              {expandIcon || <ExpandIcon isExpanded={isExpanded} />}
            </div>
          )}
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
