import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import Card from 'sentry/components/card';
import {Button} from 'sentry/components/core/button';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import type {LinkProps} from 'sentry/components/core/link';
import {Link} from 'sentry/components/core/link';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';

interface Props {
  detail: React.ReactNode;
  onFavorite: (isFavorited: boolean) => Promise<void>;
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
        <InteractionStateLayer as="div" color={theme.tokens.content.primary} />

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
        <StyledButton
          icon={
            <IconStar
              isSolid={favorited}
              variant={favorited ? 'warning' : 'muted'}
              size="sm"
              aria-label={favorited ? t('Unstar') : t('Star')}
            />
          }
          borderless
          aria-label={favorited ? t('Starred Dashboard') : t('Star Dashboard')}
          size="xs"
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
        {renderContextMenu?.()}
      </ContextMenuWrapper>
    </CardWithoutMargin>
  );
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.tokens.border.primary};
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
  color: ${p => p.theme.tokens.content.primary};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  line-height: 1.2;
  /* @TODO(jonasbadalic) font weight normal? This is inconsisten with other titles */
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const CardLink = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;

  color: ${p => p.theme.tokens.content.primary};

  &:focus,
  &:hover {
    color: ${p => p.theme.tokens.content.primary};

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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
`;

const CardBody = styled('div')`
  background: ${p => p.theme.colors.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 100px;
  min-height: 100px;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.colors.gray100};
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  height: 42px;
`;

const DateSelected = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  grid-column-gap: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  gap: ${space(0.5)};
`;

const StyledButton = styled(Button)`
  margin-right: -10px;
  padding: 5px;
`;

export default DashboardCard;
