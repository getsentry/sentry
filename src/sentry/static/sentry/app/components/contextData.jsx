import PropTypes from 'prop-types';
import React from 'react';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import isArray from 'lodash/isArray';

import AnnotatedText from 'app/components/events/meta/annotatedText';
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

class ToggleWrap extends React.Component {
  static propTypes = {
    highUp: PropTypes.bool,
    wrapClassName: PropTypes.string,
  };

  state = {toggled: false};

  render() {
    if (React.Children.count(this.props.children) === 0) {
      return null;
    }

    const {wrapClassName, children} = this.props;
    const wrappedChildren = <span className={wrapClassName}>{children}</span>;

    if (this.props.highUp) {
      return wrappedChildren;
    }

    const classes = ['val-toggle'];
    if (this.state.toggled) {
      classes.push('val-toggle-open');
    }

    return (
      <span className={classes.join(' ')}>
        <a
          href="#"
          className="val-toggle-link"
          onClick={evt => {
            this.setState(state => ({toggled: !state.toggled}));
            evt.preventDefault();
          }}
        />
        {wrappedChildren}
      </span>
    );
  }
}

class ContextData extends React.Component {
  static propTypes = {
    data: PropTypes.any,
    preserveQuotes: PropTypes.bool,
    withAnnotatedText: PropTypes.bool,
    meta: PropTypes.any,
  };

  static defaultProps = {
    data: null,
    withAnnotatedText: false,
  };

  renderValue = value => {
    const {preserveQuotes, meta, withAnnotatedText} = this.props;

    function getValueWithAnnotatedText(v, meta) {
      return <AnnotatedText value={v} meta={meta} />;
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

        const valueToBeReturned = withAnnotatedText
          ? getValueWithAnnotatedText(valueInfo.repr, meta)
          : valueInfo.repr;

        const out = [
          <span
            key="value"
            className={
              (valueInfo.isString ? 'val-string' : '') +
              (valueInfo.isStripped ? ' val-stripped' : '') +
              (valueInfo.isMultiLine ? ' val-string-multiline' : '')
            }
          >
            {preserveQuotes ? `"${valueToBeReturned}"` : valueToBeReturned}
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
        const valueToBeReturned =
          withAnnotatedText && meta ? getValueWithAnnotatedText(value, meta) : value;
        return <span>{valueToBeReturned}</span>;
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
            <ToggleWrap highUp={depth <= 2} wrapClassName="val-array-items">
              {children}
            </ToggleWrap>
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
            <ToggleWrap highUp={depth <= 1} wrapClassName="val-dict-items">
              {children}
            </ToggleWrap>
            <span className="val-dict-marker">{'}'}</span>
          </span>
        );
      }
    }
    return walk(value, 0);
  };

  render() {
    const {
      data,
      preserveQuotes: _preserveQuotes,
      withAnnotatedText: _withAnnotatedText,
      meta: _meta,
      children,
      ...other
    } = this.props;

    return (
      <pre className="val-string" {...other}>
        {this.renderValue(data)}
        {children}
      </pre>
    );
  }
}

ContextData.displayName = 'ContextData';

export default ContextData;
