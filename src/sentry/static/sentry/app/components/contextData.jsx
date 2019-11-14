import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';

import classNames from 'classnames';

import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import isArray from 'lodash/isArray';

import {isUrl} from 'app/utils';

function looksLikeObjectRepr(value) {
  const a = value[0];
  const z = value[value.length - 1];
  if (a === '<' && z === '>') {
    return true;
  } else if (a === '[' && z === ']') {
    return true;
  } else if (a === '(' && z === ')') {
    return true;
  } else if (z === ')' && value.match(/^[\w\d._-]+\(/)) {
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
  const rv = {
    repr: value,
    isString: true,
    isMultiLine: false,
    isStripped: false,
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

class ContextData extends React.Component {
  static propTypes = {
    data: PropTypes.any,
    preserveQuotes: PropTypes.bool,
  };

  static defaultProps = {
    data: null,
  };

  renderValue = value => {
    function toggle(evt) {
      $(evt.target)
        .parent()
        .toggleClass('val-toggle-open');
      evt.preventDefault();
    }

    const {preserveQuotes} = this.props;

    function makeToggle(highUp, childCount, children) {
      if (childCount === 0) {
        return null;
      }
      if (highUp) {
        return children;
      }
      return (
        <span className="val-toggle">
          <a href="#" className="val-toggle-link" onClick={toggle} />
          {children}
        </span>
      );
    }

    /*eslint no-shadow:0*/
    function walk(value, depth) {
      let i = 0;
      const children = [];
      if (value === null) {
        return <span className="val-null">{'None'}</span>;
      } else if (value === true || value === false) {
        return <span className="val-bool">{value ? 'True' : 'False'}</span>;
      } else if (isString(value)) {
        const valueInfo = analyzeStringForRepr(value);

        const out = [
          <span
            key="value"
            className={
              (valueInfo.isString ? 'val-string' : 'val-repr') +
              (valueInfo.isStripped ? ' val-stripped' : '') +
              (valueInfo.isMultiLine ? ' val-string-multiline' : '')
            }
          >
            {preserveQuotes ? `"${valueInfo.repr}"` : valueInfo.repr}
          </span>,
        ];

        if (valueInfo.isString && isUrl(value)) {
          out.push(
            <a key="external" href={value} className="external-icon">
              <em className="icon-open" />
            </a>
          );
        }

        return out;
      } else if (isNumber(value)) {
        return <span className="val-number">{value}</span>;
      } else if (isArray(value)) {
        for (i = 0; i < value.length; i++) {
          children.push(
            <span className="val-array-item" key={i}>
              {walk(value[i], depth + 1)}
              {i < value.length - 1 ? (
                <span className="val-array-sep">{', '}</span>
              ) : null}
            </span>
          );
        }
        return (
          <span className="val-array">
            <span className="val-array-marker">{'['}</span>
            {makeToggle(
              depth <= 2,
              children.length,
              <span className="val-array-items">{children}</span>
            )}
            <span className="val-array-marker">{']'}</span>
          </span>
        );
      } else if (React.isValidElement(value)) {
        return value;
      } else {
        const keys = Object.keys(value);
        keys.sort(naturalCaseInsensitiveSort);
        for (i = 0; i < keys.length; i++) {
          const key = keys[i];
          children.push(
            <span className="val-dict-pair" key={key}>
              <span className="val-dict-key">
                <span className="val-string">{preserveQuotes ? `"${key}"` : key}</span>
              </span>
              <span className="val-dict-col">{': '}</span>
              <span className="val-dict-value">
                {walk(value[key], depth + 1)}
                {i < keys.length - 1 ? (
                  <span className="val-dict-sep">{', '}</span>
                ) : null}
              </span>
            </span>
          );
        }
        return (
          <span className="val-dict">
            <span className="val-dict-marker">{'{'}</span>
            {makeToggle(
              depth <= 1,
              children.length,
              <span className="val-dict-items">{children}</span>
            )}
            <span className="val-dict-marker">{'}'}</span>
          </span>
        );
      }
    }
    return walk(value, 0);
  };

  renderKeyPosValue = value => {
    if (isString(value)) {
      return <span className="val-string">{value}</span>;
    }
    return this.renderValue(value);
  };

  render() {
    const {data, className, preserveQuotes: _preserveQuotes, ...other} = this.props;

    return (
      <pre className={classNames('val', className || '')} {...other}>
        {this.renderValue(data)}
      </pre>
    );
  }
}

ContextData.displayName = 'ContextData';

export default ContextData;
