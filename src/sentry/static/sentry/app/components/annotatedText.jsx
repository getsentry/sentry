import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

const Redaction = styled.span`
  cursor: default;
`;

const RedactionText = styled.span`
  background: rgba(255, 0, 0, 0.05);
`;

const RedactionIcon = styled(InlineSvg)`
  color: ${props => props.theme.redDark};
`;

class AnnotatedText extends React.Component {
  static propTypes = {
    text: PropTypes.string,
    meta: PropTypes.object,
    renderWith: PropTypes.func,
  };

  static defaultProps = {
    renderWith: text => text,
  };

  renderChunk(chunk) {
    let content = this.props.renderWith(chunk.text);

    if (chunk.type === 'redaction') {
      let title = t('Redacted due to PII rule "%s"', chunk.rule_id);
      return (
        <Tooltip title={title}>
          <Redaction>
            <RedactionText>{content}</RedactionText>{' '}
            <RedactionIcon src="icon-circle-exclamation" />
          </Redaction>
        </Tooltip>
      );
    }

    return <span>{content}</span>;
  }

  render() {
    // TODO(ja): Context!
    let {text, meta, renderWith} = this.props;
    let chunks = meta && meta.chunks;
    if (!text || !chunks || !chunks.length) {
      return renderWith(text);
    }

    return (
      <span>
        {chunks.map((chunk, key) => React.cloneElement(this.renderChunk(chunk), {key}))}
      </span>
    );
  }
}

export default AnnotatedText;
