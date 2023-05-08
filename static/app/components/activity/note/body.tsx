import marked from 'sentry/utils/marked';

type Props = {
  text: string;
  className?: string;
};

function NoteBody({className, text}: Props) {
  return (
    <div
      className={className}
      data-test-id="activity-note-body"
      dangerouslySetInnerHTML={{__html: marked(text)}}
    />
  );
}

export default NoteBody;
