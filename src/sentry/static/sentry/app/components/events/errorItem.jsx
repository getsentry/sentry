import React from "react";

var EventErrorItem = React.createClass({
  getInitialState(){
    return {
      isOpen: false,
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.isOpen != nextState.isOpen) {
      return true;
    }
  },

  toggle() {
    this.setState({isOpen: !this.state.isOpen});
  },

  render() {
    var error = this.props.error;
    var isOpen = this.state.isOpen;
    return (
      <li>
        {error.message}
        <small> <a style={{marginLeft: 10}} onClick={this.toggle}>{isOpen ? 'Collapse' : 'Expand'}</a></small>
        <pre style={{display: isOpen ? 'block' : 'none'}}>{JSON.stringify(error.data, null, 2)}</pre>
      </li>
    );
  }
});

export default EventErrorItem;
