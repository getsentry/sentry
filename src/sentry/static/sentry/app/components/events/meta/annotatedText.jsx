import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import {t, tn} from 'app/locale';

const Chunks = styled('span')`
  span {
    display: inline;
  }
`;

const Redaction = styled('span')`
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
  s: 'Replaced',
  m: 'Masked',
  p: 'Pseudonymized',
  e: 'Encrypted',
};

const KNOWN_RULES = {
  '!limit': 'size limits',
  '!raw': 'raw payload',
  '!config': 'SDK configuration',
};

function getTooltipText(remark, rule) {
  const remark_title = REMARKS[remark];
  const rule_title = KNOWN_RULES[rule] || t('PII rule "%s"', rule);
  if (remark_title) {
    return t('%s because of %s', remark_title, rule_title);
  } else {
    return rule_title;
  }
}

function renderChunk(chunk) {
  if (chunk.type === 'redaction') {
    const title = getTooltipText(chunk.remark, chunk.rule_id);
    return (
      <Tooltip title={title}>
        <Redaction>{chunk.text}</Redaction>
      </Tooltip>
    );
  }

  return <span>{chunk.text}</span>;
}

function renderChunks(chunks) {
  const spans = chunks.map((chunk, key) => React.cloneElement(renderChunk(chunk), {key}));

  return <Chunks>{spans}</Chunks>;
}

function renderValue(value, chunks, errors, remarks) {
  if (chunks.length > 1) {
    return renderChunks(chunks);
  }

  let element = null;
  if (value) {
    element = <Redaction>{value}</Redaction>;
  } else if (errors && errors.length) {
    element = <Placeholder>invalid</Placeholder>;
  } else if (remarks && remarks.length) {
    element = <Placeholder>redacted</Placeholder>;
  }

  if (remarks && remarks.length) {
    const title = getTooltipText(remarks[0][1], remarks[0][0]);
    element = <Tooltip title={title}>{element}</Tooltip>;
  }

  return element;
}

function renderErrors(errors) {
  if (!errors.length) {
    return null;
  }

  const tooltip = (
    <div style={{'text-align': 'left'}}>
      <strong>{tn('Processing Error:', 'Processing Errors:', errors.length)}</strong>
      <ul>
        {errors.map(e => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <Tooltip title={tooltip}>
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
