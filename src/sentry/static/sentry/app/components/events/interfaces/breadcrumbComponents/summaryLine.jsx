import React from 'react';


function isOverflowing(el) {
  return el.clientHeight < el.scrollHeight;
}

const SummaryLine = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired
  },

  getInitialState() {
    return {
      expanded: false,
      hasOverflow: false
    }
  },

  makeSummariesGreatAgain(ref) {
    let hasOverflow = isOverflowing(ref);
    if (hasOverflow !== this.state.hasOverflow) {
      this.setState({
        hasOverflow: hasOverflow
      });
    }
  },

  onToggle() {
    this.setState({
      expanded: !this.state.expanded
    });
  },

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
        ref={this.makeSummariesGreatAgain}>
        {this.props.children}
      </div>
    );
  }
});

export default SummaryLine;
