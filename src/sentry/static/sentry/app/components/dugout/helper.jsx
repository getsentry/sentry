import React from 'react';
import {browserHistory} from 'react-router';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import $ from 'jquery';
import DugoutHandle from './handle';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import ApiMixin from '../../mixins/apiMixin';
import GuideStore from '../../stores/guideStore';

const DugoutHelper = createReactClass({
  displayName: 'DugoutHelper',

  // mixins: [ApiMixin, Reflux.listenTo(GuideStore, 'onGuideChange')],
  mixins: [ApiMixin, Reflux.connect(GuideStore, 'guide')],

  getInitialState() {
    return {
      pathname: null,
      isDrawerOpen: false,
      guide: null,
      currentStep: null,
    };
  },

  componentWillMount() {
    this.handleLocationChange(window.location.pathname);
    this.unlisten = browserHistory.listen(location => {
      this.handleLocationChange(location.pathname);
    });
  },

  componentWillUnmount() {
    this.unlisten();
  },

  handleLocationChange(pathname) {
    if (this.state.pathname == pathname) {
      return;
    }
    this.setState({
      pathname,
      isDrawerOpen: false,
    });
    if (pathname.match(/\/issues\/\d+\/([?]|$)/)) {
      this.setState({guide: this.guides.issues});
    } else {
      this.setState({guide: null});
    }
  },

  guides: {
    issues: {
      cue: 'Click here for a tour of the issue page',
      steps: [
        {
          title: '1. Stacktraces',
          message:
            'See which line in your code caused the error and the entire call ' +
            'stack at that point. Get additional context like stack locals, ' +
            'browser environment, and any custom data sent by the client.',
          elementID: 'exception',
        },
        {
          title: '2. Breadcrumbs',
          message:
            'Breadcrumbs allow you to see the events that happened before the error. ' +
            'This is often useful to understand what may have triggered the error ' +
            'and includes things like HTTP requests, database calls, and any other ' +
            'custom data you record. Breadcrumbs also integrate seamlessly with many ' +
            'popular web frameworks.',
          elementID: 'breadcrumbs',
        },
      ],
    },
  },

  largeMessage() {
    return (
      <div className="dugout-message-large">
        <div className="dugout-message-large-title">{this.state.guide.title}</div>
        <div className="dugout-message-large-text">{this.state.guide.description}</div>
      </div>
    );
  },

  maybeScroll(nextStep) {
    const elementID = this.state.guide && this.state.guide.steps[nextStep].elementID;
    if (elementID) {
      $('html, body').animate(
        {
          scrollTop: $('#' + elementID).offset().top,
        },
        1000
      );
    }
  },

  onButtonClick() {
    this.setState({
      isDrawerOpen: true,
      currentStep: 0,
    });
    this.maybeScroll(0);
  },

  nextHandler() {
    const nextStep = this.state.currentStep + 1;
    this.setState({
      currentStep: nextStep,
    });
    this.maybeScroll(nextStep);
  },

  closeHandler() {
    this.setState({
      isDrawerOpen: false,
    });
  },

  render() {
    const cue = this.state.guide ? this.state.guide.cue : 'Need Help?';
    return (
      <div className="dugout-container">
        {this.state.isDrawerOpen ? (
          <div className="dugout-drawer">
            {this.state.guide ? (
              <GuideDrawer
                guide={this.state.guide}
                step={this.state.currentStep}
                nextHandler={this.nextHandler}
                closeHandler={this.closeHandler}
              />
            ) : (
              <SupportDrawer />
            )}
          </div>
        ) : (
          <DugoutHandle cue={cue} onClick={this.onButtonClick} />
        )}
      </div>
    );
  },
});

export default DugoutHelper;
