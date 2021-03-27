import React from 'react';
import styled from '@emotion/styled';

import ActivityAvatar from 'app/components/activity/item/avatar';
import Card from 'app/components/card';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {User} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  title?: string;
  subtitle?: string;
  detail?: string;
  createdBy?: User | undefined;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
  renderContextMenu?: () => React.ReactNode;
  bodyHeight?: string;
} & Pick<Link['props'], 'to'>;

class MiniCard extends React.PureComponent<Props> {
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
      children,
      createdBy,
      dateStatus,
      bodyHeight,
      to,
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={to}>
        <StyledCard interactive>
          <MiniCardHeader>
            <MiniCardContent>
              <MiniCardTitle>{title}</MiniCardTitle>
              <MiniCardDetail>{detail}</MiniCardDetail>
            </MiniCardContent>
            <AvatarWrapper>
              {createdBy ? (
                <ActivityAvatar type="user" user={createdBy} size={34} />
              ) : (
                <ActivityAvatar type="system" size={34} />
              )}
            </AvatarWrapper>
          </MiniCardHeader>
          <MiniCardBody height={bodyHeight ?? '100px'}>{children}</MiniCardBody>
          <MiniCardFooter>
            <DateSelected>
              {subtitle}
              {dateStatus && <DateStatus>{dateStatus}</DateStatus>}
            </DateSelected>
            {renderContextMenu && renderContextMenu()}
          </MiniCardFooter>
        </StyledCard>
      </Link>
    );
  }
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.border};
  border-radius: 50%;
  height: min-content;
`;

const MiniCardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const StyledCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
`;

const MiniCardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const MiniCardTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const MiniCardDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  line-height: 1.5;
  ${overflowEllipsis};
`;

const MiniCardBody = styled('div')<{height}>`
  background: ${p => p.theme.backgroundSecondary};
  max-height: ${p => p.height};
  height: 100%;
  overflow: hidden;
`;

const MiniCardFooter = styled('div')`
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

export default MiniCard;
