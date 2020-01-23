import React, {CSSProperties} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {selectText} from 'app/utils/selectText';
import {isRenderFunc} from 'app/utils/isRenderFunc';

type ChildRenderProps = {
  doSelect: () => void;
  doMount: (el: HTMLElement) => void;
};

type ChildFunction = (props: ChildRenderProps) => React.ReactNode;

type Props = {
  /**
   * Can be a `node` for a simple auto select div container.
   * When children is a render function, it is passed 2 functions:
   * - `doMount` - should be applied on parent element's `ref` whose
   * children is the text to be copied
   * - `doSelect` - selects text
   */
  children: React.ReactNode | ChildFunction;
  className?: string;
  style?: CSSProperties;
};

class AutoSelectText extends React.Component<Props> {
  static propTypes = {
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
  };

  private el: HTMLElement | undefined;

  selectText = () => {
    if (!this.el) {
      return;
    }

    selectText(this.el);
  };

  handleMount = (el: HTMLElement) => {
    this.el = el;
  };

  render() {
    const {children, className, ...props} = this.props;

    if (isRenderFunc<ChildFunction>(children)) {
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
