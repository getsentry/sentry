import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

class HighlightComponent extends React.Component {
  static propTypes = {
    /**
     * The text to highlight
     */
    text: PropTypes.string,

    /**
     * Should highlighting be disabled?
     */
    disabled: PropTypes.bool,

    /**
     * The original text (MUST be a string)
     */
    children: PropTypes.string,
  };

  render() {
    const {className, children, disabled, text} = this.props;

    if (!text || disabled) {
      return children;
    }

    const highlightText = text.toLowerCase();
    const idx = children.toLowerCase().indexOf(highlightText);

    if (idx === -1) {
      return children;
    }

    return (
      <React.Fragment>
        {children.substr(0, idx)}
        <span className={className}>{children.substr(idx, highlightText.length)}</span>
        {children.substr(idx + highlightText.length)}
      </React.Fragment>
    );
  }
}

const Highlight = styled(HighlightComponent)`
  font-weight: normal;
  background-color: ${p => p.theme.yellowLight};
  color: ${p => p.theme.gray4};
`;

Highlight.propTypes = HighlightComponent.propTypes;

export default Highlight;
export {HighlightComponent};
