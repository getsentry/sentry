import {render, screen} from 'sentry-test/reactTestingLibrary';

import SuspectReleases from 'sentry/components/group/suspectReleases';

describe('SuspectReleases', () => {
  it('displays a suspect release', async () => {
    const group = TestStubs.Group();
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/suspect-releases/`,
      body: {
        suspectReleases: [TestStubs.Release({authors: [TestStubs.User()]})],
      },
    });
    render(<SuspectReleases group={group} />);
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
  });
});
