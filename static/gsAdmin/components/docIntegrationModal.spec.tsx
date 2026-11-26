import {DocIntegrationFixture} from 'getsentry-test/fixtures/docIntegration';
import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {openModal} from '@sentry/scraps/modal';

import {DocIntegrationModal} from 'admin/components/docIntegrationModal';

const FEATURES = [
  {description: '', featureGate: 'integrations-stacktrace-link', featureId: 23},
  {description: '', featureGate: 'integrations-issue-link', featureId: 1},
];

describe('DocIntegrationModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({url: '/integration-features/', body: FEATURES});
  });

  it('creates a doc integration with numeric popularity and resource rows', async () => {
    const createRequest = MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      method: 'POST',
      body: DocIntegrationFixture({slug: 'new-integration'}),
    });
    const onSubmit = jest.fn();

    renderGlobalModal();
    act(() => openModal(deps => <DocIntegrationModal {...deps} onSubmit={onSubmit} />));

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Meow meow');
    await userEvent.type(screen.getByRole('textbox', {name: 'Author'}), 'Hellboy');
    await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'A thing');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'URL'}),
      'https://www.meow.com'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Resource Title'}),
      'Report Issue'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Resource URL'}),
      'https://www.meow.com/report-issue/'
    );
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Popularity'}), '8');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Features'}), [
      'stacktrace-link',
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        '/doc-integrations/',
        expect.objectContaining({
          method: 'POST',
          data: {
            name: 'Meow meow',
            author: 'Hellboy',
            description: 'A thing',
            url: 'https://www.meow.com',
            resources: [
              {title: 'Report Issue', url: 'https://www.meow.com/report-issue/'},
            ],
            popularity: 8,
            features: [23],
          },
        })
      )
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({slug: 'new-integration'})
    );
  });

  it('blocks submission until required fields are filled', async () => {
    const createRequest = MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      method: 'POST',
      body: DocIntegrationFixture({}),
    });

    renderGlobalModal();
    act(() => openModal(deps => <DocIntegrationModal {...deps} />));

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Meow');
    await userEvent.click(screen.getByRole('button', {name: 'Create'}));

    expect(
      await screen.findByText('Name must be at least 5 characters')
    ).toBeInTheDocument();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('updates an existing doc integration and removes a resource row', async () => {
    const docIntegration = DocIntegrationFixture({
      resources: [{title: 'Docs', url: 'https://www.meow.com/docs/'}],
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: `/doc-integrations/${docIntegration.slug}/`,
      method: 'PUT',
      body: docIntegration,
    });
    const onSubmit = jest.fn();

    renderGlobalModal();
    act(() =>
      openModal(deps => (
        <DocIntegrationModal
          {...deps}
          docIntegration={docIntegration}
          onSubmit={onSubmit}
        />
      ))
    );

    expect(await screen.findByRole('textbox', {name: 'Name'})).toHaveValue('hellboy');
    await userEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(
      screen.queryByRole('textbox', {name: 'Resource Title'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Update'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        `/doc-integrations/${docIntegration.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            name: 'hellboy',
            author: 'hellboy',
            description: 'no work just meow meow',
            url: 'https://www.meow.com',
            resources: [],
            popularity: 8,
            features: [23],
            isDraft: false,
          },
        })
      )
    );
    expect(onSubmit).toHaveBeenCalledWith(docIntegration);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
