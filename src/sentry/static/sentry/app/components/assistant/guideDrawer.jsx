import Reflux from 'reflux';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ApiMixin from '../../mixins/apiMixin';
import GuideStore from '../../stores/guideStore';
import GuideActions from '../../actions/guideActions';

// GuideDrawer is what slides up when the user clicks on a guide cue.
const GuideDrawer = createReactClass({
  displayName: 'GuideDrawer',

  propTypes: {
    guide: PropTypes.object.isRequired,
    closeHandler: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin, Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      step: 0,
    };
  },

  onGuideStateChange(data) {
    this.setState({
      step: data.currentStep,
    });
  },

  nextHandler() {
    GuideActions.nextStep();
  },

  usefulHandler(useful) {
    this.api.request('/assistant/', {
      method: 'PUT',
      data: {
        guide_id: this.props.guide.id,
        status: 'viewed',
        useful,
      },
    });
    this.props.closeHandler();
  },

  dismissHandler() {
    this.api.request('/assistant/', {
      method: 'PUT',
      data: {
        guide_id: this.props.guide.id,
        status: 'dismissed',
      },
    });
    this.props.closeHandler();
  },

  render() {
    return (
      <div>
        <div className="assistant-drawer-title">
          {this.props.guide.steps[this.state.step].title}
        </div>
        <div className="assistant-drawer-message">
          {this.props.guide.steps[this.state.step].message}
        </div>
        <div>
          {this.state.step < this.props.guide.steps.length - 1 ? (
            <div>
              <a className="btn btn-default" onClick={this.nextHandler}>
                Next &rarr;
              </a>
              <a className="btn btn-default" onClick={this.dismissHandler}>
                Dismiss
              </a>
            </div>
          ) : (
            <div>
              <p>Did you find this guide useful?</p>
              <a className="btn btn-default" onClick={() => this.usefulHandler(true)}>
                Yes &nbsp; &#x2714;
              </a>
              <a className="btn btn-default" onClick={() => this.usefulHandler(false)}>
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
