import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';

import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import GuideStore from '../../stores/guideStore';

const GuideAnchor = createReactClass({
  propTypes: {
    target: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  },

  mixins: [Reflux.listenTo(GuideStore, 'onGuideChange')],

  getInitialState() {
    return {
      active: false,
    };
  },

  componentDidMount() {
    GuideStore.registerAnchor(this);
  },

  componentWillUnmount() {
    GuideStore.unregisterAnchor(this);
  },

  onGuideChange(data) {
    if (
      data.currentGuide &&
      data.currentGuide.steps &&
      data.currentGuide.steps[data.currentStep].target == this.props.target
    ) {
      this.setState({active: true});
    } else {
      this.setState({active: false});
    }
  },

  render() {
    let {target, type} = this.props;
    let {currentGuide} = this.state;

    currentGuide;

    return (
      <div className={classNames('guide-anchor', type)} onClick={this.handleClick}>
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
