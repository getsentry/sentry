import PropTypes from 'prop-types';
import React from 'react';

import marked from 'app/utils/marked';

class NoteBody extends React.Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
  };

  render() {
    const {className, item} = this.props;

    const noteBody = marked(item.data.text);
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
