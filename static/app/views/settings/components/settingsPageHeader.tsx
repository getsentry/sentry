import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  /**
   * The page title
   */
  title: React.ReactNode;
  /**
   * A CTA Button
   */
  action?: React.ReactNode;
  body?: React.ReactNode;
  className?: string;
  /**
   * Use a purple color for the subtitle
   */
  colorSubtitle?: boolean;
  /**
   * Icon to the left of the title
   */
  icon?: React.ReactNode;
  /**
   * Disables font styles in the title. Allows for more custom titles.
   */
  noTitleStyles?: boolean;
  subtitle?: React.ReactNode;
  tabs?: React.ReactNode;
};

function UnstyledSettingsPageHeader({
  icon,
  title,
  subtitle,
  colorSubtitle,
  action,
  body,
  tabs,
  noTitleStyles = false,
  ...props
}: Props) {
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
              {subtitle && <Subtitle colorSubtitle={colorSubtitle}>{subtitle}</Subtitle>}
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

interface TitleProps extends React.HTMLAttributes<HTMLDivElement> {
  styled?: boolean;
  tabs?: React.ReactNode;
}

const HeaderTitle = styled('h4')`
  ${p => p.theme.text.pageTitle};
  color: ${p => p.theme.headingColor};
  flex: 1;
  margin: 0;
`;

const TitleAndActions = styled('div')<{isNarrow?: boolean}>`
  display: flex;
  align-items: ${p => (p.isNarrow ? 'center' : 'flex-start')};
`;
const TitleWrapper = styled('div')`
  flex: 1;
`;

const Title = styled('div')<TitleProps>`
  ${p => !p.styled && `font-size: 20px; font-weight: 600;`};
  margin: ${space(4)} ${space(2)} ${space(3)} 0;
`;
const Subtitle = styled('div')<{colorSubtitle?: boolean}>`
  color: ${p => (p.colorSubtitle ? p.theme.purple400 : p.theme.gray400)};
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
