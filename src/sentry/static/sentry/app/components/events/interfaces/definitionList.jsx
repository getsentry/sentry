import React from "react";
import _ from "underscore";

import ContextData from "../../contextData";

var DefinitionList = React.createClass({
  propTypes: {
    data: React.PropTypes.array.isRequired,
    isContextData: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      isContextData: false
    };
  },

  render() {
    let data = _.sortBy(this.props.data, (key, value) => key);
    return (
      <dl className="vars">
        {data.map(([key, value]) => {
          return [
            <dt key={"dt-" + key}>{key}</dt>,
            this.props.isContextData
              ? <dd key={"dd-" + key}><ContextData data={value}/></dd>
              : <dd key={"dd-" + key}><pre>{value || '&nbsp;'}</pre></dd>

          ];
        })}
      </dl>
    );
  }
});

export default DefinitionList;
