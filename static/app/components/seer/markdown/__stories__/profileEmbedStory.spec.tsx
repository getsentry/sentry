import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfileEmbedStory} from './profileEmbedStory';

const PROJECT_SLUG = 'javascript';
const PROFILE_ID = '7f3c2b1a9d8e4f60';

function mockProfileSearch(data: Array<Record<string, unknown>>) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {data, meta: {fields: {}, units: {}}},
  });
}

describe('ProfileEmbedStory', () => {
  beforeEach(() => {
    // The block level fetches the payload itself, and the embed's own spec
    // covers what it renders, so degrade it to the inline link here.
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${PROJECT_SLUG}/profiling/profiles/${PROFILE_ID}/`,
      body: {},
      statusCode: 404,
    });
  });

  it('embeds the most recent transaction-based profile', async () => {
    const eventsRequest = mockProfileSearch([
      {
        'profile.id': PROFILE_ID,
        'project.name': PROJECT_SLUG,
        timestamp: '2026-08-25T16:37:12Z',
      },
    ]);

    render(<ProfileEmbedStory />);

    // Both `profile.id` and `project.name` have to land in the embed's data for
    // the flamegraph route to resolve.
    const links = await screen.findAllByRole('link', {name: 'Profile 7f3c2b1a'});
    expect(links[0]).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/profiles/profile/${PROJECT_SLUG}/${PROFILE_ID}/flamegraph/`
    );

    // Continuous profiles carry a profiler id instead, which the embed schema
    // cannot address, so the search must exclude them.
    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({query: 'is_transaction:true has:profile.id'}),
      })
    );
  });

  it('says so when the organization has no profiles', async () => {
    mockProfileSearch([]);

    render(<ProfileEmbedStory />);

    expect(
      await screen.findByText('No profile is available for this organization.')
    ).toBeInTheDocument();
  });
});
