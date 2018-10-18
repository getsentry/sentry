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

const Redaction = styled.span`
  background: rgba(255, 0, 0, 0.05);
  cursor: default;
`;

const Placeholder = styled(Redaction)`
  font-style: italic;

  :before {
    content: '<';
  }
  :after {
    content: '>';
  }
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

function renderChunk(chunk) {
  if (chunk.type === 'redaction') {
    let title = t('%s due to PII rule "%s"', REMARKS[chunk.remark], chunk.rule_id);
    return (
      <Tooltip title={title}>
        <Redaction>{chunk.text}</Redaction>
      </Tooltip>
    );
  }

  return <span>{chunk.text}</span>;
}

function renderChunks(chunks) {
  if (chunks.length === 1) {
    return chunks[0].text;
  }

  let spans = chunks.map((chunk, key) => React.cloneElement(renderChunk(chunk), {key}));

  return <Chunks>{spans}</Chunks>;
}

function renderValue(value, chunks, errors, remarks) {
  if (chunks.length) {
    return renderChunks(chunks);
  }

  let element = null;
  if (!_.isNull(value)) {
    element = <Redaction>{value}</Redaction>;
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

function renderErrors(errors) {
  if (!errors.length) {
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

function AnnotatedText({value, chunks, errors, remarks, props}) {
  return (
    <span {...props}>
      {renderValue(value, chunks, errors, remarks)} {renderErrors(errors)}
    </span>
  );
}

AnnotatedText.propTypes = {
  value: PropTypes.string,
  chunks: PropTypes.array,
  errors: PropTypes.array,
  remarks: PropTypes.array,
  props: PropTypes.object,
};

AnnotatedText.defaultProps = {
  chunks: [],
  errors: [],
  remarks: [],
  props: {},
};

export default AnnotatedText;
