import React from 'react';

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
    let hasOverflow = isOverflowing(this.domElement);
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
        {this.props.children}
      </div>
    );
  }
}

export default SummaryLine;
