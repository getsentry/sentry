import React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'app/components/activity/item/avatar';
import Card from 'app/components/card';
import Link from 'app/components/links/link';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {User} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  title?: string;
  subtitle?: string;
  detail?: React.ReactNode;
  to: object;
  createdBy?: User | undefined;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
  renderWidgets: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
};

class DashboardCard extends React.PureComponent<Props> {
  handleClick = () => {
    const {onEventClick} = this.props;
    callIfFunction(onEventClick);
  };

  render() {
    const {
      title,
      subtitle,
      detail,
      renderContextMenu,
      renderWidgets,
      createdBy,
      dateStatus,
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={this.props.to}>
        <StyledDashboardCard interactive>
          <DashboardCardHeader>
            <DashboardCardContent>
              <DashboardTitle>{title}</DashboardTitle>
              <DashboardDetail>{detail}</DashboardDetail>
            </DashboardCardContent>
            <AvatarWrapper>
              {createdBy ? (
                <ActivityAvatar type="user" user={createdBy} size={34} />
              ) : (
                <ActivityAvatar type="system" size={34} />
              )}
            </AvatarWrapper>
          </DashboardCardHeader>
          <DashboardCardBody>{renderWidgets()}</DashboardCardBody>
          <DashboardCardFooter>
            <DateSelected>
              {subtitle}
              {dateStatus ? (
                <DateStatus>
                  {t('Created')} {dateStatus}
                </DateStatus>
              ) : null}
            </DateSelected>
            {renderContextMenu && renderContextMenu()}
          </DashboardCardFooter>
        </StyledDashboardCard>
      </Link>
    );
  }
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.border};
  border-radius: 50%;
  height: min-content;
`;

const DashboardCardContent = styled('div')`
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

const DashboardCardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const DashboardTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const DashboardDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  line-height: 1.5;
  ${overflowEllipsis};
`;

const DashboardCardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 150px;
  height: 150px;
  overflow: hidden;
`;

const DashboardCardFooter = styled('div')`
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
