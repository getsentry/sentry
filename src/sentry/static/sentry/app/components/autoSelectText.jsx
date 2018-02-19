import React from 'react';
import PropTypes from 'prop-types';

import {selectText} from '../utils/selectText';

class AutoSelectText extends React.Component {
  static propTypes = {
    /**
     * Can be a `string` for a simple auto select div container.
     * When children is a render function, it is passed 2 functions:
     * - `doMount` - should be applied on parent element's `ref`
     *   (or `innerRef` for styled components) whose children is the
     *   text to be copied
     * - `doSelect` - selects text
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  };

  selectText = () => {
    if (!this.el) return;

    selectText(this.el);
  };

  handleMount = el => {
    this.el = el;
  };

  render() {
    let {children, ...props} = this.props;

    if (typeof children === 'function') {
      return children({
        doMount: this.handleMount,
        doSelect: this.selectText,
      });
    }

    return (
      <div {...props} ref={this.handleMount} onClick={this.selectText}>
        {children}
      </div>
    );
  }
}

export default AutoSelectText;
