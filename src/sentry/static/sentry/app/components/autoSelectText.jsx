import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {selectText} from 'app/utils/selectText';

class AutoSelectText extends React.Component {
  static propTypes = {
    /**
     * Can be a `node` for a simple auto select div container.
     * When children is a render function, it is passed 2 functions:
     * - `doMount` - should be applied on parent element's `ref`
     *   (or `innerRef` for styled components) whose children is the
     *   text to be copied
     * - `doSelect` - selects text
     */
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  selectText = () => {
    if (!this.el) {
      return;
    }

    selectText(this.el);
  };

  handleMount = el => {
    this.el = el;
  };

  render() {
    const {children, className, ...props} = this.props;

    if (typeof children === 'function') {
      return children({
        doMount: this.handleMount,
        doSelect: this.selectText,
      });
    }

    // use an inner span here for the selection as otherwise the selectText
    // function will create a range that includes the entire part of the
    // div (including the div itself) which causes newlines to be selected
    // in chrome.
    return (
      <div
        {...props}
        onClick={this.selectText}
        className={classNames('auto-select-text', className)}
      >
        <span ref={this.handleMount}>{children}</span>
      </div>
    );
  }
}

export default AutoSelectText;
