import React from 'react';
import jQuery from 'jquery';
import {isUrl} from '../utils';

function looksLikeObjectRepr(value) {
  let a = value[0];
  let z = value[value.length - 1];
  if (a == '<' && z == '>') {
    return true;
  } else if (a == '[' && z == ']') {
    return true;
  } else if (a == '(' && z == ')') {
    return true;
  } else if (z == ')' && value.match(/^[\w\d._-]+\(/)) {
    return true;
  }
  return false;
}

function looksLikeMultiLineString(value) {
  return !!value.match(/[\r\n]/);
}

function padNumbersInString(string) {
  return string.replace(/(\d+)/g, function(num) {
    let isNegative = false;
    num = parseInt(num, 10);
    if (num < 0) {
      num *= -1;
      isNegative = true;
    }
    let s = '0000000000000' + num;
    s = s.substr(s.length - (isNegative ? 11 : 12));
    if (isNegative) {
      s = '-' + s;
    }
    return s;
  });
}

function naturalCaseInsensitiveSort(a, b) {
  a = padNumbersInString(a).toLowerCase();
  b = padNumbersInString(b).toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}

function analyzeStringForRepr(value) {
  let rv = {
    repr: value,
    isString: true,
    isMultiLine: false,
    isStripped: false
  };

  // stripped for security reasons
  if (value.match(/^['"]?\*{8,}['"]?$/)) {
    rv.isStripped = true;
    return rv;
  }

  if (looksLikeObjectRepr(value)) {
    rv.isString = false;
  } else {
    rv.isMultiLine = looksLikeMultiLineString(value);
  }

  return rv;
}


const ContextData = React.createClass({
  propTypes: {
    data: React.PropTypes.any
  },

  getDefaultProps() {
    return {
      data: null
    };
  },

  renderValue(value) {
    function toggle(evt) {
      jQuery(evt.target).parent().toggleClass('val-toggle-open');
      evt.preventDefault();
    }

    function makeToggle(highUp, childCount, children) {
      if (childCount === 0) {
        return null;
      }
      if (highUp) {
        return children;
      }
      return (
        <span className="val-toggle">
          <a href="#" className="val-toggle-link" onClick={toggle}></a>
          {children}
        </span>
      );
    }

    /*eslint no-shadow:0*/
    function walk(value, depth) {
      let i = 0, children = [];
      if (value === null) {
        return <span className="val-null">{'None'}</span>;
      } else if (value === true || value === false) {
        return <span className="val-bool">{value ? 'True' : 'False'}</span>;
      } else if (typeof value === 'string' || value instanceof String) {
        let valueInfo = analyzeStringForRepr(value);

        let out = [<span key="value" className={
            (valueInfo.isString ? 'val-string' : 'val-repr') +
            (valueInfo.isStripped ? ' val-stripped' : '') +
            (valueInfo.isMultiLine ? ' val-string-multiline' : '')}>{
              valueInfo.repr}</span>];

        if (valueInfo.isString && isUrl(value)) {
          out.push(
            <a key="external" href={value} className="external-icon">
              <em className="icon-open" />
            </a>
          );
        }

        return out;
      } else if (typeof value === 'number' || value instanceof Number) {
        return <span className="val-number">{value}</span>;
      } else if (value instanceof Array) {
        for (i = 0; i < value.length; i++) {
          children.push(
            <span className="val-array-item" key={i}>
              {walk(value[i], depth + 1)}
              {i < value.length - 1 ? <span className="val-array-sep">{', '}</span> : null}
            </span>
          );
        }
        return (
          <span className="val-array">
            <span className="val-array-marker">{'['}</span>
            {makeToggle(depth <= 2, children.length,
                        <span className="val-array-items">{children}</span>)}
            <span className="val-array-marker">{']'}</span>
          </span>
        );
      } else {
        let keys = Object.keys(value);
        keys.sort(naturalCaseInsensitiveSort);
        for (i = 0; i < keys.length; i++) {
          let key = keys[i];
          children.push(
            <span className="val-dict-pair" key={key}>
              <span className="val-dict-key">
                <span className="val-string">{key}</span>
              </span>
              <span className="val-dict-col">{': '}</span>
              <span className="val-dict-value">
                {walk(value[key], depth + 1)}
                {i < keys.length - 1 ? <span className="val-dict-sep">{', '}</span> : null}
              </span>
            </span>
          );
        }
        return (
          <span className="val-dict">
            <span className="val-dict-marker">{'{'}</span>
            {makeToggle(depth <= 1, children.length,
                        <span className="val-dict-items">{children}</span>)}
            <span className="val-dict-marker">{'}'}</span>
          </span>
        );
      }
    }
    return walk(value, 0);
  },

  renderKeyPosValue(value) {
    if (typeof value === 'string' || value instanceof String) {
      return <span className="val-string">{value}</span>;
    }
    return this.renderValue(value);
  },

  render() {
    // XXX(dcramer): babel does not support this yet
    // let {data, className, ...other} = this.props;
    let data = this.props.data;
    let className = this.props.className;
    let other = {};
    for (let key in this.props) {
      if (key !== 'data' && key !== 'className') {
        other[key] = this.props[key];
      }
    }
    other.className = 'val ' + (className || '');

    return (
      <pre {...other}>{this.renderValue(data)}</pre>
    );
  }
});

export default ContextData;
