import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

const GuideDrawer = createReactClass({
  displayName: 'GuideDrawer',

  propTypes: {
    guide: PropTypes.object.isRequired,
    step: PropTypes.number.isRequired,
    nextHandler: PropTypes.func.isRequired,
    dismissHandler: PropTypes.func.isRequired,
    usefulHandler: PropTypes.func.isRequired,
    notUsefulHandler: PropTypes.func.isRequired,
  },

  render() {
    const step = this.props.step;
    return (
      <div>
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
              <a className="btn btn-default" onClick={this.props.dismissHandler}>
                Dismiss
              </a>
            </div>
          ) : (
            <div>
              <p>Did you find this guide useful?</p>
              <a className="btn btn-default" onClick={this.props.usefulHandler}>
                Yes &nbsp; &#x2714;
              </a>
              <a className="btn btn-default" onClick={this.props.notUsefulHandler}>
                No &nbsp; &#x2716;
              </a>
            </div>
          )}
        </div>
      </div>
    );
  },
});

export default GuideDrawer;
