import React from 'react';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import {t, tn} from 'app/locale';
import {Chunks, Meta, MetaError} from 'app/types';

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

type Props = {
  value: React.ReactNode;
  meta?: Meta;
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

function renderChunk(chunk: Chunks): React.ReactElement {
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

function renderChunks(chunks: Array<Chunks>): React.ReactElement {
  const spans = chunks.map((chunk, key) => React.cloneElement(renderChunk(chunk), {key}));

  return <ChunksSpan>{spans}</ChunksSpan>;
}

function renderValue(value: React.ReactNode, meta?: Meta): React.ReactNode {
  if (meta?.chunks?.length && meta.chunks.length > 1) {
    return renderChunks(meta.chunks);
  }

  let element = value;
  if (value && meta) {
    element = <Redaction>{value}</Redaction>;
  } else if (meta?.err?.length) {
    element = <Placeholder>invalid</Placeholder>;
  } else if (meta?.rem?.length) {
    element = <Placeholder>redacted</Placeholder>;
  }

  if (meta?.rem?.length) {
    const title = getTooltipText(meta.rem[0][1], meta.rem[0][0]);
    element = <Tooltip title={title}>{element}</Tooltip>;
  }

  return element;
}

function getErrorMessage(error: MetaError) {
  const errorMessage: string[] = [];
  if (error[0]) {
    errorMessage.push(error[0]);
  }
  if (error[1] && error[1].reason) {
    errorMessage.push(error[1].reason);
  }

  return errorMessage.join(': ');
}

function renderErrors(errors: Array<MetaError>) {
  if (!errors.length) {
    return null;
  }

  const tooltip = (
    <div style={{textAlign: 'left'}}>
      <strong>{tn('Processing Error:', 'Processing Errors:', errors.length)}</strong>
      <ul>
        {errors.map((error, index) => (
          <li key={index}>{getErrorMessage(error)}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <Tooltip title={tooltip}>
      <IconWarning color="red500" />
    </Tooltip>
  );
}

class AnnotatedText extends React.Component<Props, {}> {
  render() {
    const {value, meta, ...props} = this.props;
    return (
      <span {...props}>
        {renderValue(value, meta)}
        {meta?.err && renderErrors(meta.err)}
      </span>
    );
  }
}

const ChunksSpan = styled('span')`
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

export default AnnotatedText;
