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

  // CTA button
  action?: React.ReactNode;

  body?: React.ReactNode;

  tabs?: React.ReactNode;
};

class UnstyledSettingsPageHeader extends React.Component<Props> {
  static defaultProps = {
    noTitleStyles: false,
  };

  render() {
    const {
      icon,
      title,
      subtitle,
      action,
      tabs,
      noTitleStyles,
      body,
      ...props
    } = this.props;

    // If Header is narrow, use align-items to center <Action>.
    // Otherwise, use a fixed margin to prevent an odd alignment.
    // This is needed as Actions could be a button or a dropdown.
    const isNarrow = !subtitle;

    return (
      <div {...props}>
        <TitleAndActions isNarrow={isNarrow}>
          <TitleWrapper>
            {icon && <Icon>{icon}</Icon>}
            {title && (
              <Title tabs={tabs} styled={noTitleStyles}>
                <HeaderTitle>{title}</HeaderTitle>
                {subtitle && <Subtitle>{subtitle}</Subtitle>}
              </Title>
            )}
          </TitleWrapper>
          {action && <Action isNarrow={isNarrow}>{action}</Action>}
        </TitleAndActions>

        {body && <BodyWrapper>{body}</BodyWrapper>}
        {tabs && <TabsWrapper>{tabs}</TabsWrapper>}
      </div>
    );
  }
}

type TitleProps = {
  styled?: boolean;
  tabs?: React.ReactNode;
};

const TitleAndActions = styled('div')<{isNarrow?: boolean}>`
  display: flex;
  align-items: ${p => (p.isNarrow ? 'center' : 'flex-start')};
`;
const TitleWrapper = styled('div')`
  flex: 1;
`;

const Title = styled('div')<TitleProps & React.HTMLProps<HTMLDivElement>>`
  ${p => !p.styled && `font-size: 20px; font-weight: 600;`};
  margin: ${space(4)} ${space(2)} ${space(3)} 0;
`;
const Subtitle = styled('div')`
  color: ${p => p.theme.gray400};
  font-weight: 400;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1.5)} 0 0;
`;

const Icon = styled('div')`
  margin-right: ${space(1)};
`;

const Action = styled('div')<{isNarrow?: boolean}>`
  margin-top: ${p => (p.isNarrow ? '0' : space(4))};
`;

const SettingsPageHeader = styled(UnstyledSettingsPageHeader)<
  Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props
>`
  font-size: 14px;
  margin-top: -${space(4)};
`;

const BodyWrapper = styled('div')`
  flex: 1;
  margin: 0 0 ${space(3)};
`;
const TabsWrapper = styled('div')`
  flex: 1;
  margin: 0; /* sentry/components/navTabs has added margin */
`;

export default SettingsPageHeader;
