import React from 'react';

const SidebarItem = React.createClass({
  propTypes: {
    href: React.PropTypes.string,
    onClick: React.PropTypes.func,
    to: React.PropTypes.string
  },
  innerItem() {
    return (
      <span>
        <span className="sidebar-item-icon">
          {this.props.icon}
        </span>
        <span className="sidebar-item-label">{this.props.label}</span>
        {this.props.badge > 0 &&
          <span className="sidebar-item-badge">{this.props.badge}</span>}
      </span>
    );
  },

  render() {
    let classNames = 'sidebar-item';

    const {icon, label, active, badge, to, href, ...props} = this.props;

    const innerItem = this.innerItem();

    if (active) {
      classNames += ' active';
    }

    if (this.props.to) {
      return (
        <Link className={classNames} {...props}>
          {innerItem}
        </Link>
      );
    }
    return (
      <a className={classNames} {...props}>
        {innerItem}
      </a>
    );
  }
});

export default SidebarItem;
