import PropTypes from 'prop-types';
import React from 'react';

class LanguageNav extends React.Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    active: PropTypes.bool,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isVisible: this.props.active || false,
    };
  }

  toggle = () => {
    this.setState({isVisible: !this.state.isVisible});
  };

  render() {
    let {isVisible} = this.state;
    return (
      <div className="install-language-nav">
        <ul className="list-group">
          <li className="list-group-item list-group-header">
            <a onClick={this.toggle} style={{display: 'block'}}>
              <span className="pull-right">
                {isVisible ? (
                  <span className="icon-minus" />
                ) : (
                  <span className="icon-plus" />
                )}
              </span>
              <strong>{this.props.name}</strong>
            </a>
          </li>
          <span
            style={{
              display: isVisible ? 'block' : 'none',
            }}
          >
            {this.props.children}
          </span>
        </ul>
      </div>
    );
  }
}

export default LanguageNav;
