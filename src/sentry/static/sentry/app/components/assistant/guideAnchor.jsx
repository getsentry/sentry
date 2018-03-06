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
    // The `invisible` anchor type can be used for guides not attached to specific elements.
    type: PropTypes.oneOf(['text', 'button', 'invisible']),
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
    // Invisible pings should not be scrolled to since they are not attached to a specific element.
    if (!prevState.active && this.state.active && this.props.type !== 'invisible') {
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
      data.currentGuide.steps[data.currentStep - 1].target == this.props.target &&
      // TODO(adhiraj): It would be more correct to let invisible anchors become active,
      // and use CSS to make them invisible.
      this.props.type !== 'invisible'
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
