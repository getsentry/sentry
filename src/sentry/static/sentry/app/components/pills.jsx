import React from 'react';


const Pills = React.createClass({
  render() {
    return (
      <div className="pills">
        {this.props.children}
      </div>
    );
  }
});

export default Pills;
