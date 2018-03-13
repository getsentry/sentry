import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
import $ from 'jquery';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {registerAnchor, unregisterAnchor} from '../../actionCreators/guides';
import GuideStore from '../../stores/guideStore';

// A guide anchor provides a ripple-effect on an element on the page to draw attention
// to it. Guide anchors register with the guide store, which uses this information to
// determine which guides can be shown on the page.
const GuideAnchor = createReactClass({
  propTypes: {
    target: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['text', 'button']),
  },

  mixins: [Reflux.listenTo(GuideStore, 'onGuideStateChange')],

  getInitialState() {
    return {
      active: false,
    };
  },

  componentDidMount() {
    registerAnchor(this);
  },

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.active && this.state.active) {
      $('html, body').animate(
        {
          scrollTop: $(this.anchorElement).offset().top,
        },
        1000
      );
    }
  },

  componentWillUnmount() {
    unregisterAnchor(this);
  },

  onGuideStateChange(data) {
    if (
      data.currentGuide &&
      data.currentStep > 0 &&
      data.currentGuide.steps[data.currentStep - 1].target == this.props.target
    ) {
      this.setState({active: true});
    } else {
      this.setState({active: false});
    }
  },

  render() {
    let {target, type} = this.props;

    return (
      <div
        ref={el => (this.anchorElement = el)}
        className={classNames('guide-anchor', type)}
      >
        {this.props.children}
        <span
          className={classNames(target, 'guide-anchor-ping', {
            active: this.state.active,
          })}
        />
      </div>
    );
  },
});

export default GuideAnchor;
