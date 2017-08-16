import React, {PropTypes} from 'react';
import classNames from 'classnames';

const Hovercard = React.createClass({
  propTypes: {
    className: PropTypes.string,
    containerClassName: PropTypes.string,
    header: PropTypes.node,
    body: PropTypes.node
  },

  getInitialState() {
    return {
      visible: false
    };
  },

  handleToggleHovercard() {
    let {header, body} = this.props;

    // Don't toggle hovercard if both of these are null
    if (!header && !body) return;

    this.setState({
      visible: !this.state.visible
    });
  },

  render() {
    let {containerClassName, className, header, body} = this.props;
    let {visible} = this.state;

    let containerCx = classNames('hovercard-container', containerClassName);
    let cx = classNames('hovercard', className);

    return (
      <span
        className={containerCx}
        onMouseEnter={this.handleToggleHovercard}
        onMouseLeave={this.handleToggleHovercard}>
        {this.props.children}
        {visible &&
          <div className={cx}>
            <div className="hovercard-hoverlap" />
            {header &&
              <div className="hovercard-header">
                {header}
              </div>}
            {body &&
              <div className="hovercard-body">
                {body}
              </div>}
          </div>}
      </span>
    );
  }
});

export default Hovercard;
