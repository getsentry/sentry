import PropTypes from 'prop-types';
import React from 'react';

import marked from 'app/utils/marked';

type Props = {
  text: string;
  className: string;
};

const NoteBody: React.FC<Props> = ({className, text}) => (
  <div
    className={className}
    data-test-id="activity-note-body"
    dangerouslySetInnerHTML={{__html: marked(text)}}
  />
);

NoteBody.propTypes = {
  text: PropTypes.string.isRequired,
};

export default NoteBody;
