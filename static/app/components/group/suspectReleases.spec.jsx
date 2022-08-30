import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import SuspectReleases from 'sentry/components/group/suspectReleases';

describe('SuspectReleases', () => {
  const group = TestStubs.Group();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('displays a suspect release', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/suspect-releases/`,
      body: [TestStubs.Release({authors: [TestStubs.User()]})],
    });
    render(<SuspectReleases group={group} />);
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
  });

  it('hides when there are no suspect-releases', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/suspect-releases/`,
      body: [],
    });
    const wrapper = render(<SuspectReleases group={group} />);
    await waitFor(() => {
      expect(wrapper.container).toBeEmptyDOMElement();
    });
  });
});
