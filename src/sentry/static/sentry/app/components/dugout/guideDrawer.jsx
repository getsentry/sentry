import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

const GuideDrawer = createReactClass({
  displayName: 'GuideDrawer',

  propTypes: {
    guide: PropTypes.object.isRequired,
    step: PropTypes.number.isRequired,
    nextHandler: PropTypes.func.isRequired,
    closeHandler: PropTypes.func.isRequired,
  },

  render() {
    const step = this.props.step;
    return (
      <div className="dugout-drawer">
        <div className="dugout-drawer-title">{this.props.guide.steps[step].title}</div>
        <div className="dugout-drawer-message">
          {this.props.guide.steps[step].message}
        </div>
        <div>
          {step < this.props.guide.steps.length - 1 ? (
            <div>
              <a className="btn btn-default" onClick={this.props.nextHandler}>
                Next &rarr;
              </a>
              <a className="btn btn-default" onClick={this.props.closeHandler}>
                Dismiss
              </a>
            </div>
          ) : (
            <a className="btn btn-default" onClick={this.props.closeHandler}>
              Done &#x2713;
            </a>
          )}
        </div>
      </div>
    );
  },
});

export default GuideDrawer;
