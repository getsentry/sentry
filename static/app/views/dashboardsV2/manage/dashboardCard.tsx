import React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'app/components/activity/item/avatar';
import Card from 'app/components/card';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {User} from 'app/types';

type Props = {
  title: string;
  detail: React.ReactNode;
  to: React.ComponentProps<typeof Link>['to'];
  renderWidgets: () => React.ReactNode;
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

const Title = styled(TextOverflow)`
  color: ${p => p.theme.textColor};
`;

const Detail = styled(TextOverflow)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  line-height: 1.5;
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 150px;
  height: 150px;
  overflow: hidden;
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const DateSelected = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-column-gap: ${space(1)};
  color: ${p => p.theme.textColor};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.purple300};
  padding-left: ${space(1)};
`;

export default DashboardCard;
