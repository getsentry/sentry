import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {parseComposerDocument} from '@sentry/scraps/composer/document';

import {DocumentComposerDemo} from './documentDemos';

jest.unmock('prismjs');

it('keeps a team mention identity when replacing it in the demo', async () => {
  const user = userEvent.setup();
  render(<DocumentComposerDemo />);

  await user.click(screen.getByRole('button', {name: 'Change mention Frontend'}));

  expect(
    screen.queryByRole('button', {name: 'Change mention Frontend'})
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: 'Change mention Platform'})).toHaveLength(
    2
  );
  const document = parseComposerDocument(
    JSON.parse(
      screen.getByRole<HTMLTextAreaElement>('textbox', {name: 'Document JSON'}).value
    )
  );
  const teamMentions = document.blocks.flatMap(block =>
    block.type === 'paragraph' || block.type === 'quote'
      ? block.children.filter(
          child => child.type === 'mention' && child.actorType === 'team'
        )
      : []
  );
  expect(teamMentions).toEqual([
    {type: 'mention', actorType: 'team', id: 'team-2', label: 'Platform'},
    {type: 'mention', actorType: 'team', id: 'team-2', label: 'Platform'},
  ]);
});

it.each(['dropzone', 'editor'])('queues a file once when dropped on the %s', target => {
  render(<DocumentComposerDemo />);
  const dropzone = screen.getByRole('group', {name: 'Composer dropzone'});
  const destination =
    target === 'editor'
      ? screen.getByRole('combobox', {name: 'Comment document'})
      : dropzone;
  const file = new File(['example'], 'example.txt', {type: 'text/plain'});
  const dataTransfer = {types: ['Files'], files: [file]};

  fireEvent.dragEnter(destination, {dataTransfer});
  expect(screen.getByText('Drop files to attach')).toBeVisible();

  fireEvent(
    destination,
    new MouseEvent('dragleave', {
      bubbles: true,
      relatedTarget: screen.getByRole('button', {name: 'Bold'}),
    })
  );
  expect(screen.getByText('Drop files to attach')).toBeVisible();

  fireEvent.drop(destination, {dataTransfer});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', {name: 'Insert example.txt'})).toHaveLength(1);
});

it('ignores text drags and clears the file target when the drag leaves the composer', () => {
  render(<DocumentComposerDemo />);
  const dropzone = screen.getByRole('group', {name: 'Composer dropzone'});
  const text = {types: ['text/plain'], files: []};
  fireEvent.dragEnter(dropzone, {dataTransfer: text});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();

  const file = new File(['example'], 'example.txt', {type: 'text/plain'});
  const dataTransfer = {types: ['Files'], files: [file]};
  fireEvent.dragEnter(dropzone, {dataTransfer});
  expect(screen.getByText('Drop files to attach')).toBeVisible();
  fireEvent.dragLeave(dropzone, {dataTransfer, relatedTarget: null});
  expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
});
