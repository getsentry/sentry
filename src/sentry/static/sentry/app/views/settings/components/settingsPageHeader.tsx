import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {HeaderTitle} from 'app/styles/organization';

type Props = {
  // The title
  title: React.ReactNode;

  // Disables font styles in the title. Allows for more custom titles.
  noTitleStyles?: boolean;

  className?: string;

  // Icon left of title
  icon?: React.ReactNode;

  // Actions on opposite end of title bar from the title
  action?: React.ReactNode;

  tabs?: React.ReactNode;
};

class SettingsPageHeading extends React.Component<Props> {
  static propTypes = {
    icon: PropTypes.node,
    title: PropTypes.node.isRequired,
    action: PropTypes.node,
    tabs: PropTypes.node,
    // Disables font styles in the title. Allows for more custom titles.
    noTitleStyles: PropTypes.bool,
  };

  static defaultProps = {
    noTitleStyles: false,
  };

  render() {
    const {icon, title, action, tabs, noTitleStyles, ...props} = this.props;
    return (
      <div {...props}>
        <TitleAndActions>
          {icon && <Icon>{icon}</Icon>}
          {title && (
            <Title tabs={tabs} styled={noTitleStyles}>
              <HeaderTitle>{title}</HeaderTitle>
            </Title>
          )}
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
  align-items: center;
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
  flex: 1;
`;

const Icon = styled('div')`
  margin-right: ${space(1)};
`;

const Action = styled('div')<{tabs?: React.ReactNode}>`
  ${p => (p.tabs ? `margin-top: ${space(2)}` : null)};
`;

const StyledSettingsPageHeading = styled(SettingsPageHeading)<
  Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props
>`
  font-size: 14px;
  margin-top: -${space(4)};
`;

export default StyledSettingsPageHeading;
