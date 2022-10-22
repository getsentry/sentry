import {Group} from 'fixtures/js-stubs/group';
import {Release} from 'fixtures/js-stubs/release';
import {User} from 'fixtures/js-stubs/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import SuspectReleases from 'sentry/components/group/suspectReleases';

describe('SuspectReleases', () => {
  const group = Group();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('displays a suspect release', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/suspect-releases/`,
      body: [Release({authors: [User()]})],
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
