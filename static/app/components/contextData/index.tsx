import {Component, isValidElement} from 'react';
import styled from '@emotion/styled';
import isArray from 'lodash/isArray';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {Meta} from 'sentry/types';
import {isUrl} from 'sentry/utils';

import Toggle from './toggle';
import {analyzeStringForRepr, naturalCaseInsensitiveSort} from './utils';

type Value = null | string | boolean | number | {[key: string]: Value} | Value[];

type Props = React.HTMLAttributes<HTMLPreElement> & {
  data: Value;
  jsonConsts?: boolean;
  maxDefaultDepth?: number;
  meta?: Meta;
  preserveQuotes?: boolean;
  withAnnotatedText?: boolean;
};

type State = {
  data: Value;
  withAnnotatedText: boolean;
};

function getValueWithAnnotatedText(v: Value, meta?: Meta) {
  return <AnnotatedText value={v} meta={meta} />;
}

class ContextData extends Component<Props, State> {
  static defaultProps = {
    data: null,
    withAnnotatedText: false,
  };

  renderValue(value: Value) {
    const {preserveQuotes, meta, withAnnotatedText, jsonConsts, maxDefaultDepth} =
      this.props;
    const maxDepth = maxDefaultDepth ?? 2;

    // eslint-disable-next-line @typescript-eslint/no-shadow
    function walk(value: Value, depth: number) {
      let i = 0;
      const children: React.ReactNode[] = [];
      if (value === null) {
        return <span className="val-null">{jsonConsts ? 'null' : 'None'}</span>;
      }

      if (value === true || value === false) {
        return (
          <span className="val-bool">
            {jsonConsts ? (value ? 'true' : 'false') : value ? 'True' : 'False'}
          </span>
        );
      }

      if (isString(value)) {
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
      }

      if (isNumber(value)) {
        const valueToBeReturned =
          withAnnotatedText && meta ? getValueWithAnnotatedText(value, meta) : value;
        return <span>{valueToBeReturned}</span>;
      }

      if (isArray(value)) {
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
            <Toggle highUp={depth <= maxDepth} wrapClassName="val-array-items">
              {children}
            </Toggle>
            <span className="val-array-marker">{']'}</span>
          </span>
        );
      }

      if (isValidElement(value)) {
        return value;
      }

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
              {i < keys.length - 1 ? <span className="val-dict-sep">{', '}</span> : null}
            </span>
          </span>
        );
      }
      return (
        <span className="val-dict">
          <span className="val-dict-marker">{'{'}</span>
          <Toggle highUp={depth <= maxDepth - 1} wrapClassName="val-dict-items">
            {children}
          </Toggle>
          <span className="val-dict-marker">{'}'}</span>
        </span>
      );
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
      <pre {...other}>
        {this.renderValue(data)}
        {children}
      </pre>
    );
  }
}

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;

export default ContextData;
