import React from 'react';
import styled from '@emotion/styled';

import {HeaderTitle} from 'app/styles/organization';
import space from 'app/styles/space';

type Props = {
  // Icon left of title
  icon?: React.ReactNode;

  // The title
  title: React.ReactNode;
  subtitle?: React.ReactNode;

  // Disables font styles in the title. Allows for more custom titles.
  noTitleStyles?: boolean;
  className?: string;

  action?: React.ReactNode;
  tabs?: React.ReactNode;
};

class UnstyledSettingsPageHeader extends React.Component<Props> {
  static defaultProps = {
    noTitleStyles: false,
  };

  render() {
    const {icon, title, subtitle, action, tabs, noTitleStyles, ...props} = this.props;
    return (
      <div {...props}>
        <TitleAndActions>
          <TitleWrapper>
            {icon && <Icon>{icon}</Icon>}
            {title && (
              <Title tabs={tabs} styled={noTitleStyles}>
                <HeaderTitle>{title}</HeaderTitle>
                {subtitle && <Subtitle>{subtitle}</Subtitle>}
              </Title>
            )}
          </TitleWrapper>
          {action && <Action tabs={tabs}>{action}</Action>}
        </TitleAndActions>

        {tabs && <div>{tabs}</div>}
      </div>
    );
  }
}

type TitleProps = {
  styled?: boolean;
  tabs?: React.ReactNode;
};

const TitleAndActions = styled('div')`
  display: flex;
  align-items: baseline;
`;
const TitleWrapper = styled('div')`
  flex: 1;
`;

const Title = styled('div')<TitleProps & React.HTMLProps<HTMLDivElement>>`
  ${p =>
    !p.styled &&
    `
    font-size: 20px;
    font-weight: bold;`};
  margin: ${p =>
    p.tabs
      ? `${space(4)} ${space(2)} ${space(2)} 0`
      : `${space(4)} ${space(2)} ${space(4)} 0`};
`;
const Subtitle = styled('div')`
  color: ${p => p.theme.gray400};
  font-weight: 400;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1.5)} 0 ${space(3)};
`;

const Icon = styled('div')`
  margin-right: ${space(1)};
`;

const Action = styled('div')<{tabs?: React.ReactNode}>`
  ${p => (p.tabs ? `margin-top: ${space(2)}` : null)};
`;

const SettingsPageHeader = styled(UnstyledSettingsPageHeader)<
  Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props
>`
  font-size: 14px;
  margin-top: -${space(4)};
`;

export default SettingsPageHeader;
