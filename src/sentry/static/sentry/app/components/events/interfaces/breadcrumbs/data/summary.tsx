import React from 'react';
import styled from '@emotion/styled';

import Highlight from 'app/components/highlight';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import {defined} from 'app/utils';

type Props = {
  searchTerm: string;
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
    const {kvData, searchTerm} = this.props;

    if (!kvData) {
      return null;
    }

    return Object.keys(kvData)
      .reverse()
      .filter(key => defined(kvData[key]) && !!kvData[key])
      .map(key => {
        const value =
          typeof kvData[key] === 'object' ? JSON.stringify(kvData[key]) : kvData[key];
        return (
          <Data key={key}>
            <StyledPre>
              <DataLabel>
                <Highlight text={searchTerm}>{`${key}: `}</Highlight>
              </DataLabel>
              <AnnotatedText
                value={<Highlight text={searchTerm}>{value}</Highlight>}
                meta={getMeta(kvData, key)}
              />
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
`;

const StyledCode = styled('code')`
  white-space: pre-wrap;
  line-height: 26px;
`;

const Data = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DataLabel = styled('strong')`
  line-height: 17px;
`;
