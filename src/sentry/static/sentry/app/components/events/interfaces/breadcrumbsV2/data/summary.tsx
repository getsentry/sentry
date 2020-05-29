import React from 'react';
import styled from '@emotion/styled';

import {getMeta} from 'app/components/events/meta/metaProxy';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';

type Props = {
  kvData?: Record<string, any>;
};

type State = {
  isExpanded: boolean;
  hasOverflow: boolean;
};

class Summary extends React.Component<Props, State> {
  state = {
    isExpanded: false,
    hasOverflow: false,
  };

  summaryNode = React.createRef<HTMLDivElement>();

  onToggle = () => {
    this.setState(prevState => ({
      isExpanded: !prevState.isExpanded,
    }));
  };

  renderData = () => {
    const {kvData} = this.props;

    if (!kvData) {
      return null;
    }

    return Object.keys(kvData)
      .filter(key => defined(kvData[key]) && !!kvData[key])
      .map(key => {
        const value =
          typeof kvData[key] === 'object' ? JSON.stringify(kvData[key]) : kvData[key];
        return (
          <Data key={key}>
            <StyledPre>
              <DataLabel>{`${key}: `}</DataLabel>
              {getBreadcrumbCustomRendererValue({
                value,
                meta: getMeta(kvData, key),
              })}
            </StyledPre>
          </Data>
        );
      });
  };

  // TODO(Priscila): implement Summary lifecycles
  render() {
    const {children} = this.props;
    return (
      <React.Fragment>
        <div onClick={this.onToggle} ref={this.summaryNode}>
          <StyledPre>
            <StyledCode>{children}</StyledCode>
          </StyledPre>
        </div>
        {this.renderData()}
      </React.Fragment>
    );
  }
}

export default Summary;

const StyledPre = styled('pre')`
  padding: 0;
  background: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
  }
`;

const StyledCode = styled('code')`
  white-space: nowrap;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    white-space: pre-wrap;
  }
  line-height: 26px;
`;

const Data = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DataLabel = styled('strong')`
  line-height: 17px;
`;
