import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
import styled from 'react-emotion';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {registerAnchor, unregisterAnchor} from '../../actionCreators/guides';
import GuideStore from '../../stores/guideStore';
import {expandOut} from '../../styles/animations';

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
      this.anchorElement.scrollIntoView({
        behavior: 'smooth',
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
        />
      </GuideAnchorContainer>
    );
  },
});

const GuideAnchorContainer = styled('div')`
  ${p =>
    p.type == 'text' &&
    `
      display: inline-block;
      position: relative;
    `};
`;

const StyledGuideAnchor = styled('span')`
  width: 20px;
  height: 20px;
  cursor: pointer;
  z-index: 999;
  position: relative;
  pointer-events: none;
  animation: ${expandOut} 1.5s ease-out infinite;
  visibility: hidden;

  &,
  &:before,
  &:after {
    position: absolute;
    display: block;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background-color: ${p => p.theme.greenTransparent25};
    border-radius: 50%;
  }

  &:before,
  &:after {
    content: '';
  }

  &:before {
    width: 75%;
    height: 75%;
    background-color: ${p => p.theme.greenTransparent25};
  }

  &:after {
    width: 50%;
    height: 50%;
    color: ${p => p.theme.green};
  }

  ${p => (p.active ? 'visibility: visible;' : '')};
`;

export default GuideAnchor;
