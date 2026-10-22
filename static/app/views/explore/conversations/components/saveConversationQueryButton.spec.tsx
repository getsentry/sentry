import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {SaveConversationQueryButton} from 'sentry/views/explore/conversations/components/saveConversationQueryButton';

jest.mock('sentry/actionCreators/modal');

const mockOpenSaveQueryModal = jest.mocked(modal.openSaveQueryModal);

describe('SaveConversationQueryButton', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockOpenSaveQueryModal.mockClear();
  });

  async function saveQuery(query: Record<string, string>) {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: '1'},
    });

    render(<SaveConversationQueryButton />, {
      organization,
      initialRouterConfig: {location: {pathname: '/', query}},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));
    const {saveQuery: save} = mockOpenSaveQueryModal.mock.calls[0]![0];
    await save({name: 'My query', starred: true});
    await waitFor(() => expect(request).toHaveBeenCalled());
    return request;
  }

  it('saves the errors only filter', async () => {
    const request = await saveQuery({errorsOnly: 'true'});

    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          dataset: 'ai_conversations',
          errorsOnly: true,
        }),
      })
    );
  });

  it('omits the errors only filter when it is off', async () => {
    const request = await saveQuery({});

    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({errorsOnly: undefined}),
      })
    );
  });
});
