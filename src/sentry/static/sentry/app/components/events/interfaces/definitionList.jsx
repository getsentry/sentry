import React from "react";
import _ from "underscore";

var DefinitionList = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  render() {
    let data = _.sortBy(this.props.data, (key, value) => key);
    return (
      <dl className="vars">
        {data.map(([key, value]) => {
          return [
            <dt key={'dt-' + key }>{key}</dt>,
            <dd key={'dd-' + key }><pre>{value || '&nbsp;'}</pre></dd>
          ];
        })}
      </dl>
    );
  }
});

export default DefinitionList;
