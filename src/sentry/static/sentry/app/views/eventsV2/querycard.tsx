import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import InlineSvg from 'app/components/inlineSvg';

import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

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
      <StyledQueryCard data-test-id={`card-${title}`} onClick={this.handleClick}>
        <QueryCardHeader>
          <StyledTitle>{title}</StyledTitle>
          <StyledQueryDetail>{queryDetail}</StyledQueryDetail>
          {starred ? (
            <StyledInlineSvg data-test-id="is-saved-query" src="icon-star-small-filled" />
          ) : null}
        </QueryCardHeader>
        <QueryCardBody>{renderGraph()}</QueryCardBody>
        <QueryCardFooter>
          <StyledCreator>{subtitle}</StyledCreator>
          {renderContextMenu && renderContextMenu()}
        </QueryCardFooter>
      </StyledQueryCard>
    );
  }
}

const StyledQueryCard = styled('button')`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: stretch;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;
  cursor: pointer;
  text-align: left;
  padding: 0;

  &:focus,
  &:hover {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.2);
    position: relative;
    top: -2px;
    outline: none;
  }

  &:active {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.5);
  }

  /* This is to ensure the graph is visually clickable */
  * {
    cursor: pointer;
  }
`;

const QueryCardHeader = styled('div')`
  position: relative;
  padding: ${space(1.5)} ${space(2)};
  overflow: hidden;
  min-height: 62px;
  line-height: 1.4;
`;

const StyledInlineSvg = styled(InlineSvg)`
  position: absolute;
  color: ${p => p.theme.yellow};
  top: ${space(2)};
  right: ${space(2)};
`;

const StyledTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray5};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: ${p => p.theme.offWhiteLight};
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
  ${overflowEllipsis};
  display: flex;
  align-items: center;
`;

export default QueryCard;
