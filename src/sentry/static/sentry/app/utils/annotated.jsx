import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import {t, tn} from 'app/locale';
import utils from 'app/utils';

const Chunks = styled.span`
  span {
    display: inline;
  }
`;

const Placeholder = styled.span`
  background: rgba(255, 0, 0, 0.05);
  cursor: default;
  font-style: italic;

  :before {
    content: '<';
  }
  :after {
    content: '>';
  }
`;

const Redaction = styled.span`
  background: rgba(255, 0, 0, 0.05);
  cursor: default;
`;

const ErrorIcon = styled(InlineSvg)`
  color: ${props => props.theme.redDark};
`;

const REMARKS = {
  a: 'Annotated',
  x: 'Removed',
  s: 'Substitued',
  m: 'Masked',
  p: 'Pseudonymized',
  e: 'Encrypted',
};

class AnnotatedSpan extends React.Component {
  static propTypes = {
    value: PropTypes.string,
    chunks: PropTypes.array,
    errors: PropTypes.array,
    remarks: PropTypes.array,
    renderWith: PropTypes.func,
  };

  static defaultProps = {
    renderWith: value => value,
  };

  renderChunk(chunk) {
    let content = this.props.renderWith(chunk.text);

    if (chunk.type === 'redaction') {
      let title = t('%s due to PII rule "%s"', REMARKS[chunk.remark], chunk.rule_id);
      return (
        <Tooltip title={title}>
          <Redaction>{content}</Redaction>
        </Tooltip>
      );
    }

    return <span>{content}</span>;
  }

  renderChunks(chunks) {
    let {renderWith} = this.props;

    if (chunks.length === 1) {
      return renderWith(chunks[0].text);
    }

    let spans = chunks.map((chunk, key) =>
      React.cloneElement(this.renderChunk(chunk), {key})
    );

    return <Chunks>{spans}</Chunks>;
  }

  renderValue() {
    let {value, chunks, remarks, errors, renderWith} = this.props;
    if (chunks && chunks.length) {
      return this.renderChunks(chunks);
    }

    let element = null;
    if (!_.isNull(value)) {
      element = renderWith(value);
    } else if (errors && errors.length) {
      element = <Placeholder>invalid</Placeholder>;
    } else if (remarks && remarks.length) {
      element = <Placeholder>redacted</Placeholder>;
    }

    if (remarks && remarks.length) {
      let title = t('%s due to PII rule "%s"', REMARKS[remarks[0][1]], remarks[0][0]);
      element = <Tooltip title={title}>{element}</Tooltip>;
    }

    return element;
  }

  renderErrors() {
    let {errors} = this.props;
    if (!errors || !errors.length) {
      return null;
    }

    let tooltip = `
    <div style="text-align: left">
      <strong>${tn('Processing Error:', 'Processing Errors:', errors.length)}</strong>
      <ul>
        ${errors.map(e => `<li>${utils.escape(e)}</li>`)}
      </ul>
    </div>
    `;

    return (
      <Tooltip title={tooltip} tooltipOptions={{html: true}}>
        <ErrorIcon src="icon-circle-exclamation" />
      </Tooltip>
    );
  }

  render() {
    return (
      <span>
        {this.renderValue()} {this.renderErrors()}
      </span>
    );
  }
}

class Annotated {
  constructor(value, meta) {
    this.value = value;
    this.meta = meta;
  }

  get(...path) {
    let value = this.value;
    let meta = this.meta;

    while (_.isObject(value) && path.length) {
      let key = String(path.shift());
      value = value[key];
      if (_.isObject(meta)) {
        meta = meta[key];
      }
    }

    return new Annotated(value, meta);
  }

  _getRenderMeta() {
    let meta = this.meta && this.meta[''];
    if (_.isEmpty(meta)) return null;
    if (!_.isEmpty(meta.chunks)) return meta;
    if (!_.isEmpty(meta.rem)) return meta;
    if (!_.isEmpty(meta.err)) return meta;
    return null;
  }

  _render(callback) {
    let renderMeta = this._getRenderMeta();
    if (!_.isNil(renderMeta)) {
      return (
        <AnnotatedSpan
          value={this.value}
          chunks={renderMeta.chunks}
          remarks={renderMeta.rem}
          errors={renderMeta.err}
          renderWith={callback}
        />
      );
    }

    if (!_.isNil(this.value)) {
      return callback(this.value);
    }

    return this.value;
  }

  render(...path) {
    let callback =
      typeof path[path.length - 1] === 'function' ? path.pop() : value => value;
    return this.get(...path)._render(callback);
  }
}

export default Annotated;
