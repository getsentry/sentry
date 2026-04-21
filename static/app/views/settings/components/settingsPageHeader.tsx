import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {useRoutes} from 'sentry/utils/useRoutes';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

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
   * Disables font styles in the title. Allows for more custom titles.
   */
  noTitleStyles?: boolean;
  subtitle?: React.ReactNode;
  tabs?: React.ReactNode;
};

function UnstyledSettingsPageHeader({
  title,
  subtitle,
  action,
  body,
  tabs,
  noTitleStyles = false,
  ...props
}: Props) {
  const routes = useRoutes();
  const hasPageFrame = useHasPageFrameFeature();
  // If Header is narrow, use align-items to center <Action>.
  // Otherwise, use a fixed margin to prevent an odd alignment.
  // This is needed as Actions could be a button or a dropdown.
  const isNarrow = !subtitle;

  // In page frame mode the breadcrumb in the TopBar serves as the page title.
  // Sync the last breadcrumb label with the actual page title and skip
  // rendering the title heading so it doesn't appear twice.
  if (hasPageFrame) {
    return (
      <Fragment>
        {typeof title === 'string' ? (
          <BreadcrumbTitle routes={routes} title={title} />
        ) : (
          title && <Layout.Title>{title}</Layout.Title>
        )}
        {action && <TopBar.Slot name="actions">{action}</TopBar.Slot>}
        {subtitle && (
          <Flex marginBottom="xl">
            <Subtitle>{subtitle}</Subtitle>
          </Flex>
        )}
        {body && <BodyWrapper>{body}</BodyWrapper>}
        {tabs && <TabsWrapper>{tabs}</TabsWrapper>}
      </Fragment>
    );
  }

  return (
    <div {...props}>
      <TitleAndActions isNarrow={isNarrow}>
        <TitleWrapper>
          {title && (
            <Title styled={noTitleStyles}>
              <Layout.Title>{title}</Layout.Title>
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

const TitleAndActions = styled('div')<{isNarrow?: boolean}>`
  display: flex;
  align-items: ${p => (p.isNarrow ? 'center' : 'flex-start')};
`;
const TitleWrapper = styled('div')`
  flex: 1;
`;

const Title = styled('div')<{styled?: boolean}>`
  ${p =>
    !p.styled && `font-size: 20px; font-weight: ${p.theme.font.weight.sans.medium};`};
  margin: ${p => p.theme.space['3xl']} ${p => p.theme.space.xl}
    ${p => p.theme.space['2xl']} 0;
`;
const Subtitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.md};
  padding: ${p => p.theme.space.lg} 0 0;
`;

const Action = styled('div')<{isNarrow?: boolean}>`
  margin-top: ${p => (p.isNarrow ? '0' : p.theme.space['3xl'])};
`;

export const SettingsPageHeader = styled(UnstyledSettingsPageHeader)<
  Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props
>`
  font-size: 14px;
  margin-top: -${p => p.theme.space['3xl']};
`;

const BodyWrapper = styled('div')`
  flex: 1;
  margin: 0 0 ${p => p.theme.space['2xl']};
`;
const TabsWrapper = styled('div')`
  flex: 1;
  margin: 0;
`;
