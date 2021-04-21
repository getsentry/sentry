import React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'app/components/activity/item/avatar';
import Card from 'app/components/card';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {User} from 'app/types';

type Props = {
  title: string;
  detail: React.ReactNode;
  to: React.ComponentProps<typeof Link>['to'];
  renderWidgets: () => React.ReactNode;
  createdBy?: User | undefined;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
};

export function DashboardCard(props: Props) {
  function onClick() {
    props.onEventClick?.();
  }

  return (
    <Link data-test-id={`card-${props.title}`} onClick={onClick} to={props.to}>
      <StyledDashboardCard interactive>
        <CardHeader>
          <CardContent>
            <Title>{props.title}</Title>
            <Detail>{props.detail}</Detail>
          </CardContent>
          <AvatarWrapper>
            {props.createdBy ? (
              <ActivityAvatar type="user" user={props.createdBy} size={34} />
            ) : (
              <ActivityAvatar type="system" size={34} />
            )}
          </AvatarWrapper>
        </CardHeader>
        <CardBody>{props.renderWidgets()}</CardBody>
        <CardFooter>
          <DateSelected>
            {props.dateStatus ? (
              <DateStatus>
                {t('Created')} {props.dateStatus}
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
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

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  line-height: 1.5;
  ${overflowEllipsis};
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

const DateSelected = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-column-gap: ${space(1)};
  ${overflowEllipsis};
  color: ${p => p.theme.textColor};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.purple300};
  padding-left: ${space(1)};
`;

export default DashboardCard;
