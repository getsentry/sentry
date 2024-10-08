import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import Card from 'sentry/components/card';
import type {LinkProps} from 'sentry/components/links/link';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';

interface Props {
  detail: React.ReactNode;
  renderWidgets: () => React.ReactNode;
  title: string;
  to: LinkProps['to'];
  createdBy?: User;
  dateStatus?: React.ReactNode;
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
}: Props) {
  function onClick() {
    onEventClick?.();
  }

  return (
    <Link data-test-id={`card-${title}`} onClick={onClick} to={to} aria-label={title}>
      <StyledDashboardCard interactive>
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
          {renderContextMenu?.()}
        </CardFooter>
      </StyledDashboardCard>
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <StyledDashboardCard interactive>
      <CardHeader>
        <CardContent>
          <SkeletonPulse />
        </CardContent>
        <AvatarWrapper>
          <ActivityAvatar size={34} />
        </AvatarWrapper>
      </CardHeader>
      <CardBody>
        <SkeletonPulse />
      </CardBody>
      <CardFooter>
        <SkeletonPulse />
      </CardFooter>
    </StyledDashboardCard>
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

const StyledDashboardCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
  max-width: 500px;
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const Title = styled('div')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightNormal};
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

const SkeletonPulse = styled('div')`
  $from: #f5f5f5;
  $to: scale-color($from, $lightness: -10%);

  height: 100%;
  width: 100%;
  background: linear-gradient(-90deg, #efefef 0%, #fcfcfc 50%, #efefef 100%);
  background-size: 400% 400%;
  animation: pulse 1.2s ease-in-out infinite;
  @keyframes pulse {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: -135% 0%;
    }
  }
`;

export default DashboardCard;
