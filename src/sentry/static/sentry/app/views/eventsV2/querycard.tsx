import React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'app/components/activity/item/avatar';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';
import {User} from 'app/types';
import Card from 'app/components/card';

type Props = {
  title?: string;
  subtitle?: string;
  queryDetail?: string;
  to: object;
  createdBy?: User | undefined;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
  renderGraph: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
};

class QueryCard extends React.PureComponent<Props> {
  handleClick = () => {
    const {onEventClick} = this.props;
    callIfFunction(onEventClick);
  };

  render() {
    const {
      title,
      subtitle,
      queryDetail,
      renderContextMenu,
      renderGraph,
      createdBy,
      dateStatus,
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={this.props.to}>
        <StyledQueryCard interactive>
          <QueryCardHeader>
            <QueryCardContent>
              <QueryTitle>{title}</QueryTitle>
              <QueryDetail>{queryDetail}</QueryDetail>
            </QueryCardContent>
            <AvatarWrapper>
              {createdBy ? (
                <ActivityAvatar type="user" user={createdBy} size={34} />
              ) : (
                <ActivityAvatar type="system" size={34} />
              )}
            </AvatarWrapper>
          </QueryCardHeader>
          <QueryCardBody>{renderGraph()}</QueryCardBody>
          <QueryCardFooter>
            <DateSelected>
              {subtitle}
              {dateStatus ? (
                <DateStatus>
                  {t('Edited')} {dateStatus}
                </DateStatus>
              ) : null}
            </DateSelected>
            {renderContextMenu && renderContextMenu()}
          </QueryCardFooter>
        </StyledQueryCard>
      </Link>
    );
  }
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.border};
  border-radius: 50%;
  height: min-content;
`;

const QueryCardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const StyledQueryCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
`;

const QueryCardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const QueryTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const QueryDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  line-height: 1.5;
  ${overflowEllipsis};
`;

const QueryCardBody = styled('div')`
  background: ${p => p.theme.gray200};
  max-height: 100px;
  height: 100%;
  overflow: hidden;
`;

const QueryCardFooter = styled('div')`
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
  color: ${p => p.theme.gray700};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.purple400};
  padding-left: ${space(1)};
`;

export default QueryCard;
