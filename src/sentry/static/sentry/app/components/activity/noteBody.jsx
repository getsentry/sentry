import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import marked from 'app/utils/marked';
import textStyles from 'app/styles/text';

const NoteBody = styled(
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
)``;

export default NoteBody;
