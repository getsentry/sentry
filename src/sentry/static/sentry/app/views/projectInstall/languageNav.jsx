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
        <ul className="list-group">
          <li className="list-group-item list-group-header">
            <a className="pull-right" onClick={this.toggle}>
              {isVisible ?
                <span className="icon-minus"/>
              :
                <span className="icon-plus"/>
              }
            </a>
            <strong>{this.props.name}</strong>
          </li>
          <span style={{
            display: (isVisible ? 'block' : 'none')
          }}>
            {this.props.children}
          </span>
        </ul>
      </div>
    );
  }
});

export default LanguageNav;
