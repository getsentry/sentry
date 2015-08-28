import React from "react";

var DefinitionList = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  render() {
    return (
      <dl className="vars">
        {this.props.data.map(function ([key, value]) {
            return [
              <dt key={'dt-' + key }>{key}</dt>,
              <dd key={'dd-' + key }><pre>{value}</pre></dd>
            ];
        })}
      </dl>
    );
  }
});

export default DefinitionList;
