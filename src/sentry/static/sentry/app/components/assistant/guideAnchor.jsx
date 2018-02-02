import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';

import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import GuideStore from '../../stores/guideStore';

const GuideAnchor = createReactClass({
  propTypes: {
    step: PropTypes.number.isRequired,
    target: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  },

  mixins: [Reflux.connect(GuideStore, 'currentGuide')],

  getInitialState() {
    return {
      currentGuide: null,
    };
  },

  render() {
    let {step, target, type} = this.props;
    let {currentGuide} = this.state;

    let isActive = false;
    if (currentGuide) {
      isActive = currentGuide.step == step;
    }

    return (
      <div className={classNames('guide-anchor', type)} onClick={this.handleClick}>
        {this.props.children}
        <span
          className={classNames(target, 'guide-anchor-ping', {
            active: isActive,
          })}
        />
      </div>
    );
  },
});

export default GuideAnchor;
