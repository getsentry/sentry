import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import type {LinkProps} from 'sentry/components/links/link';
import Link from 'sentry/components/links/link';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';

interface Props {
  detail: React.ReactNode;
  onFavorite: (isFavorited: boolean) => void;
  renderWidgets: () => React.ReactNode;
  title: string;
  to: LinkProps['to'];
  createdBy?: User;
  dateStatus?: React.ReactNode;
  isFavorited?: boolean;
  onEventClick?: () => void;
  renderContextMenu?: () => React.ReactNode;
}

function DashboardCard({
  title,
  detail,
  createdBy,
  renderWidgets,
  dateStatus,
  to,
  onEventClick,
  renderContextMenu,
  isFavorited = false,
  onFavorite,
}: Props) {
  const [favorited, setFavorited] = useState<boolean>(isFavorited);

  function onClick() {
    onEventClick?.();
  }

  // Fetch the theme to set the `InteractionStateLayer` color. Otherwise it will
  // use the `currentColor` of the `Link`, which is blue, and not correct
  const theme = useTheme();

  return (
    <CardWithoutMargin>
      <CardLink
        data-test-id={`card-${title}`}
        onClick={onClick}
        to={to}
        aria-label={title}
      >
        <InteractionStateLayer as="div" color={theme.textColor} />

        <CardHeader>
          <CardContent>
            <Title>{title}</Title>
            <Detail>{detail}</Detail>
          </CardContent>
          <AvatarWrapper>
            {createdBy ? (
              <ActivityAvatar type="user" user={createdBy} size={34} />
            ) : (
              <ActivityAvatar type="system" size={34} />
            )}
          </AvatarWrapper>
        </CardHeader>
        <CardBody>{renderWidgets()}</CardBody>
        <CardFooter>
          <DateSelected>
            {dateStatus ? (
              <DateStatus>
                {t('Created')} {dateStatus}
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
        </CardFooter>
      </CardLink>

      <ContextMenuWrapper>
        <Feature features="dashboards-favourite">
          <StyledButton
            icon={
              <IconStar
                isSolid={favorited}
                color={favorited ? 'yellow300' : 'gray300'}
                size="sm"
                aria-label={favorited ? t('UnFavorite') : t('Favorite')}
              />
            }
            size="zero"
            borderless
            aria-label={t('Dashboards Favorite')}
            onClick={async () => {
              try {
                setFavorited(!favorited);
                await onFavorite(!favorited);
              } catch (error) {
                // If the api call fails, revert the state
                setFavorited(favorited);
              }
            }}
          />
        </Feature>
        {renderContextMenu?.()}
      </ContextMenuWrapper>
    </CardWithoutMargin>
  );
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.border};
  border-radius: 50%;
  height: min-content;
`;

const CardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const CardWithoutMargin = styled(Card)`
  margin: 0;
`;

const Title = styled('div')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const CardLink = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;

  color: ${p => p.theme.textColor};

  &:focus,
  &:hover {
    color: ${p => p.theme.textColor};

    ${Title} {
      text-decoration: underline;
    }
  }
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
  line-height: 1.5;
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 150px;
  min-height: 150px;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.gray100};
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  height: 42px;
`;

const DateSelected = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-column-gap: ${space(1)};
  color: ${p => p.theme.textColor};
  ${p => p.theme.overflowEllipsis};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.subText};
  padding-left: ${space(1)};
`;

const ContextMenuWrapper = styled('div')`
  position: absolute;
  right: ${space(2)};
  bottom: ${space(1)};
  display: flex;
`;

const StyledButton = styled(Button)`
  margin-right: -10px;
  padding: 5px;
`;

export default DashboardCard;
