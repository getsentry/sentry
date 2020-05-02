import React from 'react';
import styled from '@emotion/styled';

import {getMeta} from 'app/components/events/meta/metaProxy';
import space from 'app/styles/space';
import {defined} from 'app/utils';

import getBreadcrumbCustomRendererValue from '../../breadcrumbs/getBreadcrumbCustomRendererValue';

type KvData = {
  [key: string]: any;
};

type Props = {
  kvData?: KvData;
};

type State = {
  isExpanded: boolean;
  hasOverflow: boolean;
};

class BreadcrumbDataSummary extends React.Component<Props, State> {
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
      .map(key => (
        <BreadcrumbDataSummaryData key={key}>
          <BreadcrumbDataSummaryDataLabel>{`${key}: `}</BreadcrumbDataSummaryDataLabel>
          <StyledPre>
            {getBreadcrumbCustomRendererValue({
              value:
                typeof kvData[key] === 'object'
                  ? JSON.stringify(kvData[key])
                  : kvData[key],
              meta: getMeta(kvData, key),
            })}
          </StyledPre>
        </BreadcrumbDataSummaryData>
      ));
  };

  // TODO(Priscila): implement Summary lifecycles
  render() {
    const {children} = this.props;
    return (
      <div>
        <div onClick={this.onToggle} ref={this.summaryNode}>
          <StyledPre>
            <code>{children}</code>
          </StyledPre>
        </div>
        {this.renderData()}
      </div>
    );
  }
}

export default BreadcrumbDataSummary;

const StyledPre = styled('pre')`
  padding: 0;
  background: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const BreadcrumbDataSummaryData = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
  margin: ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const BreadcrumbDataSummaryDataLabel = styled('strong')`
  line-height: 17px;
`;
