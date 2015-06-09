/*** @jsx React.DOM */

var React = require('react');


function renderValue(value) {
  function walk(value) {
    var i = 0, children = [];
    if (value === null) {
      return <span className="val-null">None</span>;
    } else if (value === true || value === false) {
      return <span className="val-bool">{value ? 'True' : 'False'}</span>;
    } else if (typeof value === 'string' || value instanceof String) {
      // consider auto quoting?
      return <span className="val-string">{value}</span>;
    } else if (typeof value === 'number' || value instanceof Number) {
      return <span className="val-number">{value}</span>;
    } else if (value instanceof Array) {
      for (i = 0; i < value.length; i++) {
        children.push(
          <span className="val-array-item" key={i}>
            {walk(value[i])}
            {i < value.length - 1 ? <span className="val-array-sep">{', '}</span> : null}
          </span>
        );
      }
      return (
        <span className="val-array">
          <span className="val-array-marker">{'['}</span>
          <span className="val-array-items">{children}</span>
          <span className="val-array-marker">{']'}</span>
        </span>
      );
    } else {
      var keys = Object.keys(value);
      for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        children.push(
          <span className="val-dict-pair" key={key}>
            <span className="val-dict-key">
              <span className="val-string">{key}</span>
            </span>
            <span className="val-dict-col">{': '}</span>
            <span className="val-dict-value">
              {walk(value[key])}
              {i < keys.length - 1 ? <span className="val-dict-sep">{', '}</span> : null}
            </span>
          </span>
        );
      }
      return (
        <span className="val-dict">
          <span className="val-dict-marker">{'{'}</span>
          <span className="val-dict-items">{children}</span>
          <span className="val-dict-marker">{'}'}</span>
        </span>
      );
    }
  }
  return walk(value);
}

function renderKeyPosValue(value) {
  if (typeof value === 'string' || value instanceof String) {
    return <span className="val-string">{value}</span>;
  }
  return renderValue(value);
}


var ContextData = React.createClass({
  propTypes: {
    data: React.PropTypes.any
  },

  getDefaultProps() {
    return {
      data: null
    };
  },

  render() {
    var {data, className, ...other} = this.props;
    other.className = 'val ' + (className || '');

    return (
      <pre {...other}>{renderValue(data)}</pre>
    );
  }
});

module.exports = ContextData;
