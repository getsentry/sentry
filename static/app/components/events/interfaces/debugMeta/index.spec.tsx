import {EventFixture} from 'sentry-fixture/event';
import {EntryDebugMetaFixture} from 'sentry-fixture/eventEntry';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';

describe('DebugMeta', function () {
  it('opens details modal', async function () {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const {organization, project} = initializeOrg();
    const image = eventEntryDebugMeta.data.images[0];
    const mockGetDebug = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?debug_id=${image?.debug_id}`,
      method: 'GET',
      body: [],
    });

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );
    renderGlobalModal();

    screen.getByRole('heading', {name: 'Images Loaded'});
    const imageName = image?.debug_file as string;
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText('Ok')).toBeInTheDocument();
    expect(screen.getByText(imageName)).toBeInTheDocument();
    expect(screen.getByText('Symbolication')).toBeInTheDocument();
    expect(mockGetDebug).not.toHaveBeenCalled();

    const codeFile = image?.code_file as string;
    expect(screen.queryByText(codeFile)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View'}));
    expect(screen.getByText(codeFile)).toBeInTheDocument();
    expect(mockGetDebug).toHaveBeenCalled();
  });

  it('searches image contents', async function () {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const {organization, project} = initializeOrg();
    const image = eventEntryDebugMeta.data.images[0];

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );
    const imageName = image?.debug_file as string;
    const codeFile = image?.code_file as string;

    screen.getByRole('heading', {name: 'Images Loaded'});
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    const imageNode = screen.getByText(imageName);
    expect(imageNode).toBeInTheDocument();

    const searchBar = screen.getByRole('textbox');
    await userEvent.type(searchBar, 'some jibberish');
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();
    await userEvent.clear(searchBar);
    expect(screen.getByText(imageName)).toBeInTheDocument();
    await userEvent.type(searchBar, codeFile);
    expect(screen.getByText(imageName)).toBeInTheDocument();
  });
});
