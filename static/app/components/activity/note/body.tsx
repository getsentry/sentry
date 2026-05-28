import {Markdown} from '@sentry/scraps/markdown';

type Props = {
  text: string;
};

function NoteBody({text}: Props) {
  return (
    <div data-test-id="activity-note-body">
      <Markdown raw={text} />
    </div>
  );
}

export {NoteBody};
