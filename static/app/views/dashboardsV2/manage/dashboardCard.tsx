import * as React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'sentry/components/activity/item/avatar';
import Card from 'sentry/components/card';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {User} from 'sentry/types';

type Props = {
  detail: React.ReactNode;
  renderWidgets: () => React.ReactNode;
  title: string;
  to: React.ComponentProps<typeof Link>['to'];
  createdBy?: User;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
  renderContextMenu?: () => void;
};

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
    <Link data-test-id={`card-${title}`} onClick={onClick} to={to}>
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
          {renderContextMenu && renderContextMenu()}
        </CardFooter>
      </StyledDashboardCard>
    </Link>
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
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const Title = styled('div')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  ${overflowEllipsis};
  font-weight: normal;
`;

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  ${overflowEllipsis};
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
  ${overflowEllipsis};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.purple300};
  padding-left: ${space(1)};
`;

export default DashboardCard;
