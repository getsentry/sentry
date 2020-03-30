import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';
import {IconSentry} from 'app/icons';
import UserAvatar from 'app/components/avatar/userAvatar';
import {User} from 'app/types';
import Card from 'app/components/card';

type Props = {
  title?: string;
  subtitle?: string;
  queryDetail?: string;
  starred?: boolean;
  to: object;
  createdBy: User | undefined;
  onEventClick?: () => void;
  renderGraph: () => React.ReactNode;
  renderContextMenu?: () => React.ReactNode;
};

class QueryCard extends React.PureComponent<Props> {
  handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const {onEventClick, to} = this.props;

    callIfFunction(onEventClick);
    browserHistory.push(to);
  };

  render() {
    const {
      title,
      subtitle,
      starred,
      queryDetail,
      renderContextMenu,
      renderGraph,
      createdBy,
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={this.props.to}>
        <StyledQueryCard interactive>
          <QueryCardHeader>
            <QueryCardContent>
              <QueryTitle>{title}</QueryTitle>
              <QueryDetail>{queryDetail}</QueryDetail>
            </QueryCardContent>
            {starred ? (
              <StyledUserAvatar user={createdBy} />
            ) : (
              <Avatar>
                <StyledIconSentry />
              </Avatar>
            )}
          </QueryCardHeader>
          <QueryCardBody>{renderGraph()}</QueryCardBody>
          <QueryCardFooter>
            <StyledCreator>{subtitle}</StyledCreator>
            {renderContextMenu && renderContextMenu()}
          </QueryCardFooter>
        </StyledQueryCard>
      </Link>
    );
  }
}

const StyledUserAvatar = styled(UserAvatar)`
  width: 40px;
  min-width: 40px;
  height: 40px;
  border: 3px solid ${p => p.theme.offWhite2};
`;

const QueryCardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const Avatar = styled('div')`
  border: 3px solid ${p => p.theme.offWhite2};
  background-color: ${p => p.theme.gray4};
  color: ${p => p.theme.white};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 40px;
  min-width: 40px;
  height: 40px;
`;

const StyledIconSentry = styled(IconSentry)`
  margin-bottom: 2px;
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
  color: ${p => p.theme.gray2};
  line-height: 1.5;
  ${overflowEllipsis};
`;

const QueryCardBody = styled('div')`
  background: ${p => p.theme.offWhite};
  max-height: 100px;
  height: 100%;
  overflow: hidden;
`;

const QueryCardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  color: ${p => p.theme.gray3};
`;

const StyledCreator = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  align-items: center;
  ${overflowEllipsis};
`;

export default QueryCard;
