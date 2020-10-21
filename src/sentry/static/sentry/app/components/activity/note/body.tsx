import PropTypes from 'prop-types';

import marked from 'app/utils/marked';

type Props = {
  text: string;
  className?: string;
};

const NoteBody = ({className, text}: Props) => (
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
