import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import theme from 'app/utils/theme';
import {IconBookmark} from 'app/icons/iconBookmark';
import Link from 'app/components/links/link';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';
import Card from 'app/components/card';

import {SubHeading} from './styles';

type Props = {
  title?: string;
  subtitle?: string;
  queryDetail?: string;
  starred?: boolean;
  to: object;
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
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={this.props.to}>
        <StyledQueryCard interactive>
          <QueryCardHeader>
            <CardHeading>
              {title}
              {starred && (
                <StyledIconBookmark
                  color={theme.yellow}
                  data-test-id="is-saved-query"
                  solid
                />
              )}
            </CardHeading>
            <StyledQueryDetail>{queryDetail}</StyledQueryDetail>
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

const StyledQueryCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
`;

const QueryCardHeader = styled('div')`
  position: relative;
  padding: ${space(1.5)} ${space(2)};
  overflow: hidden;
  line-height: 1.4;
  flex-grow: 1;
`;

const StyledIconBookmark = styled(IconBookmark)`
  position: absolute;
  top: 14px;
  right: ${space(2)};
`;

const CardHeading = styled(SubHeading)`
  width: 95%;
`;

const StyledQueryDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray2};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
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
