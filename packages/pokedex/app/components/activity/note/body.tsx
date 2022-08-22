import marked from 'sentry/utils/marked';

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

export default NoteBody;
