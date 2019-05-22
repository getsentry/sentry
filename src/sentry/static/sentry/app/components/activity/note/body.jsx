import PropTypes from 'prop-types';
import React from 'react';

import marked from 'app/utils/marked';

class NoteBody extends React.Component {
  static propTypes = {
    text: PropTypes.string.isRequired,
  };

  render() {
    const {className, text} = this.props;

    const noteBody = marked(text);
    return (
      <div
        className={className}
        data-test-id="activity-note-body"
        dangerouslySetInnerHTML={{__html: noteBody}}
      />
    );
  }
}

export default NoteBody;
