import React from 'react';
import Reflux from 'reflux';
import {browserHistory} from 'react-router';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import AssistantHandle from './handle';
import SupportDrawer from './supportDrawer';
import GuideDrawer from './guideDrawer';
import GuideStore from '../../stores/guideStore';
import ApiMixin from '../../mixins/apiMixin';

const AssistantHelper = createReactClass({
  displayName: 'AssistantHelper',

  mixins: [ApiMixin, Reflux.listenTo(GuideStore, 'onGuideChange')],

  getInitialState() {
    return {
      // Current URL. Determines which guide should be shown.
      pathname: null,
      isDrawerOpen: false,
    };
  },

  componentWillMount() {
    this.fetchGuides();
    this.handleLocationChange(window.location.pathname);
    this.unlisten = browserHistory.listen(location => {
      this.handleLocationChange(location.pathname);
    });
  },

  componentDidUpdate(prevProps, prevState) {
    const guide = GuideStore.getCurrentGuide();
    // Scroll to the element referenced by the current guide.
    if (
      guide &&
      this.state.isDrawerOpen &&
      this.state.currentStep !== prevState.currentStep
    ) {
      const target = guide.steps[this.state.currentStep].target;
      GuideStore.setStep(this.state.currentStep);
      if (target) {
        $('html, body').animate(
          {
            scrollTop: $('#' + target).offset().top,
          },
          1000
        );
      }
    }
  },

  componentWillUnmount() {
    this.unlisten();
  },

  handleLocationChange(pathname) {
    // If the user changes pages, close the drawer
    if (this.state.pathname != pathname) {
      this.setState({
        pathname,
        isDrawerOpen: false,
        currentStep: null,
      });
    }

    this.setState({
      guide: GuideStore.updateApplicableGuides(),
    });
  },

  fetchGuides() {
    this.api.request('/assistant/', {
      method: 'GET',
      success: response => {
        GuideStore.load(response);
        this.setState({
          guide: GuideStore.updateApplicableGuides(),
        });
      },
    });
  },

  onGuideChange(data) {
    this.setState({
      guide: data.currentGuide,
    });
  },

  onDrawerOpen() {
    this.setState({
      isDrawerOpen: true,
    });
  },

  onDrawerClose(useful = null) {
    // `useful` is a boolean if the user was on the last step of the guide and
    // submitted feedback about whether the guide was useful. Otherwise it's null.
    const guide = GuideStore.getCurrentGuide();
    if (guide) {
      if (this.state.currentStep < guide.steps.length - 1) {
        // User dismissed the guide before completing it.
        // TODO(adhiraj): Retry logic?
        /*this.api.request('/assistant/', {
          method: 'PUT',
          data: {
            guide_id: guide.id,
            status: 'dismissed',
          },
        });*/
        GuideStore.unSetGuide(guide);
      } else {
        // User completed the guide.
        const data = {
          guide_id: guide.id,
          status: 'viewed',
        };
        if (useful !== null) {
          data.useful = useful;
        }
        /*this.api.request('/assistant/', {
          method: 'PUT',
          data: data,
        });*/
      }
      this.setState({
        guidesSeen: this.state.guidesSeen.add(guide.id),
      });
    }
    this.setState({
      isDrawerOpen: false,
      currentStep: null,
    });
  },

  nextHandler() {
    this.setState(prevState => {
      return {
        currentStep: prevState.currentStep + 1,
      };
    });
  },

  usefulHandler() {
    this.onDrawerClose(true);
  },

  notUsefulHandler() {
    this.onDrawerClose(false);
  },

  render() {
    const cue = this.state.guide ? this.state.guide.cue : 'Need Help?';
    return (
      <div className="assistant-container">
        {this.state.isDrawerOpen ? (
          <div className="assistant-drawer">
            {this.state.guide ? (
              <GuideDrawer
                guide={this.state.guide}
                step={this.state.currentStep}
                nextHandler={this.nextHandler}
                dismissHandler={() => this.onDrawerClose()}
                usefulHandler={this.usefulHandler}
                notUsefulHandler={this.notUsefulHandler}
              />
            ) : (
              <SupportDrawer closeHandler={this.onDrawerClose} />
            )}
          </div>
        ) : (
          <AssistantHandle cue={cue} onClick={this.onDrawerOpen} />
        )}
      </div>
    );
  },
});

export default AssistantHelper;
