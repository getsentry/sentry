import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
import styled, {keyframes} from 'react-emotion';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import $ from 'jquery';
import {registerAnchor, unregisterAnchor} from 'app/actionCreators/guides';
import GuideStore from 'app/stores/guideStore';
import {expandOut} from 'app/styles/animations';

// A guide anchor provides a ripple-effect on an element to draw attention to it.
// Guide anchors register with the guide store, which uses this information to
// determine which guides can be shown on the page. Multiple guide anchors on
// a page can have the same `target` property, which will make all of them glow
// when a step in the guide matches that target (although only one of them will
// be scrolled to).
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
    if (!prevState.active && this.state.active && this.props.type !== 'invisible') {
      let windowHeight = $(window).height();
      $('html,body').animate({
        scrollTop: $(this.anchorElement).offset().top - windowHeight / 4,
      });
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
      <GuideAnchorContainer innerRef={el => (this.anchorElement = el)} type={type}>
        {this.props.children}
        <StyledGuideAnchor
          className={classNames('guide-anchor-ping', target)}
          active={this.state.active}
        >
          <StyledGuideAnchorRipples />
        </StyledGuideAnchor>
      </GuideAnchorContainer>
    );
  },
});

export const conditionalGuideAnchor = (condition, target, type, children) => {
  return condition
    ? React.createElement(GuideAnchor, {target, type}, children)
    : children;
};

const recedeAnchor = keyframes`
  0% {
    transform: scale(3, 3);
    opacity: 1;
  }

  100% {
    transform: scale(1, 1);
    opacity: 0.75;
  }
`;

const GuideAnchorContainer = styled('div')`
  ${p =>
    p.type == 'text' &&
    `
      display: inline-block;
      position: relative;
    `};
`;

const StyledGuideAnchor = styled('div')`
  width: 20px;
  height: 20px;
  cursor: pointer;
  z-index: 999;
  position: absolute;
  pointer-events: none;
  visibility: hidden;

  ${p =>
    p.active
      ? `
    visibility: visible;
    animation: ${recedeAnchor} 5s ease-in forwards;
  `
      : ''};
`;

const StyledGuideAnchorRipples = styled('div')`
  animation: ${expandOut} 1.5s ease-out infinite;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;

  &,
  &:before,
  &:after {
    position: absolute;
    display: block;
    left: calc(50% - 10px);
    top: calc(50% - 10px);
    background-color: ${p => p.theme.greenTransparent};
    border-radius: 50%;
  }

  &:before,
  &:after {
    content: '';
  }

  &:before {
    width: 70%;
    height: 70%;
    left: calc(50% - 7px);
    top: calc(50% - 7px);
    background-color: ${p => p.theme.greenTransparent};
  }

  &:after {
    width: 50%;
    height: 50%;
    left: calc(50% - 5px);
    top: calc(50% - 5px);
    color: ${p => p.theme.green};
  }
`;

export default GuideAnchor;
