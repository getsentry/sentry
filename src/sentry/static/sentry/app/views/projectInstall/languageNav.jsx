import React from "react";

var LanguageNav = React.createClass({
  getInitialState() {
    return {
      isVisible: this.props.active || false
    };
  },

  toggle() {
    this.setState({isVisible: !this.state.isVisible});
  },

  render() {
    var {isVisible} = this.state;
    return (
      <div>
        <h6 className="nav-header">
          {this.props.name}
          <a className="btn btn-xs btn-default" onClick={this.toggle}>
            {isVisible ?
              '-'
            :
              '+'
            }
          </a>
        </h6>
        <ul className="nav nav-stacked" style={{
          display: (isVisible ? 'block' : 'none')
        }}>
          {this.props.children}
        </ul>
      </div>
    );
  }
});

export default LanguageNav;
