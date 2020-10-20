import PropTypes from 'prop-types';
import React from 'react';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import isArray from 'lodash/isArray';
import styled from '@emotion/styled';

import AnnotatedText from 'app/components/events/meta/annotatedText';
import {IconOpen, IconAdd, IconSubtract} from 'app/icons';
import {isUrl} from 'app/utils';
import ExternalLink from 'app/components/links/externalLink';

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
  return string.replace(/(\d+)/g, function (num) {
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

    return (
      <span>
        <ToggleIcon
          isOpen={this.state.toggled}
          href="#"
          onClick={evt => {
            this.setState(state => ({toggled: !state.toggled}));
            evt.preventDefault();
          }}
        >
          {this.state.toggled ? (
            <IconSubtract size="9px" color="white" />
          ) : (
            <IconAdd size="9px" color="white" />
          )}
        </ToggleIcon>
        {this.state.toggled && wrappedChildren}
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
    jsonConsts: PropTypes.bool,
  };

  static defaultProps = {
    data: null,
    withAnnotatedText: false,
  };

  renderValue(value) {
    const {preserveQuotes, meta, withAnnotatedText, jsonConsts} = this.props;

    function getValueWithAnnotatedText(v, meta) {
      return <AnnotatedText value={v} meta={meta} />;
    }

    /*eslint no-shadow:0*/
    function walk(value, depth) {
      let i = 0;
      const children = [];
      if (value === null) {
        return <span className="val-null">{jsonConsts ? 'null' : 'None'}</span>;
      } else if (value === true || value === false) {
        return (
          <span className="val-bool">
            {jsonConsts ? (value ? 'true' : 'false') : value ? 'True' : 'False'}
          </span>
        );
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
            <ExternalLink key="external" href={value} className="external-icon">
              <StyledIconOpen size="xs" />
            </ExternalLink>
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
  }

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
      <ContextValues {...other}>
        {this.renderValue(data)}
        {children}
      </ContextValues>
    );
  }
}

ContextData.displayName = 'ContextData';

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;

const ToggleIcon = styled('a')`
  display: inline-block;
  position: relative;
  top: 1px;
  height: 11px;
  width: 11px;
  line-height: 1;
  padding-left: 1px;
  margin-left: 1px;
  border-radius: 2px;

  background: ${p => (p.isOpen ? p.theme.gray500 : p.theme.blue400)};
  &:hover {
    background: ${p => (p.isOpen ? p.theme.gray600 : p.theme.blue500)};
  }
`;

const ContextValues = styled('pre')`
  /* Not using theme to be consistent with less files */
  color: #4e3fb4;
`;

export default ContextData;
