import React from 'react';
import styled from '@emotion/styled';

function isOverflowing(el) {
  // XXX(mitsuhiko): subtract one because of reasons. Not sure which ones.
  return el.offsetHeight < el.scrollHeight - 1;
}

class SummaryLine extends React.Component {
  state = {
    expanded: false,
    hasOverflow: false,
  };

  componentDidMount() {
    this.domElement = null;
    window.addEventListener('resize', this.respondToLayoutChanges);
  }

  componentWillUnmount() {
    this.domElement = null;
    window.addEventListener('resize', this.respondToLayoutChanges);
  }

  makeSummariesGreatAgain = ref => {
    this.domElement = ref;
    this.respondToLayoutChanges();
  };

  respondToLayoutChanges = () => {
    if (!this.domElement) {
      return;
    }
    const hasOverflow = isOverflowing(this.domElement);
    if (hasOverflow !== this.state.hasOverflow) {
      this.setState({
        hasOverflow,
      });
    }
  };

  onToggle = () => {
    this.setState({
      expanded: !this.state.expanded,
    });
  };

  render() {
    let className = 'summary';
    if (this.state.hasOverflow) {
      className += ' can-expand';
    }
    if (this.state.expanded) {
      className += ' expanded';
    }
    return (
      <div
        className={className}
        onClick={this.onToggle}
        ref={this.makeSummariesGreatAgain}
      >
        <StyledPre>
          <code>{this.props.children}</code>
        </StyledPre>
      </div>
    );
  }
}

export default SummaryLine;

const StyledPre = styled('pre')`
  padding: 0;
  background: none;
  font-size: ${p => p.theme.fontSizeSmall};
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 1px 0 2px 0;
`;
