import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MOBILE_TAGS, TagFacets} from 'sentry/components/group/tagFacets';

describe('TagDistributionMeter', function () {
  let tagsMock;

  beforeEach(function () {
    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: {
        release: {
          key: 'release',
          topValues: [
            {
              name: 'org.mozilla.ios.Fennec@106.0',
              count: 30,
            },
          ],
        },
        os: {
          key: 'os',
          topValues: [
            {
              name: 'Android 12',
              count: 20,
            },
            {
              name: 'iOS 16.0',
              count: 10,
            },
          ],
        },
        device: {
          key: 'device',
          topValues: [
            {
              name: 'iPhone15',
              count: 7,
            },
            {
              name: 'Android Phone',
              count: 10,
            },
            {
              name: 'iPhone12',
              count: 13,
            },
          ],
        },
      },
    });
  });

  it('does not display anything if no tag values recieved', async function () {
    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: {},
    });
    render(<TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} />);
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('os')).not.toBeInTheDocument();
    expect(screen.queryByText('device')).not.toBeInTheDocument();
    expect(screen.queryByText('release')).not.toBeInTheDocument();
  });

  it('displays os, device, and release tags', async function () {
    render(<TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} />);
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });
    expect(screen.getByText('os')).toBeInTheDocument();
    expect(screen.getByText('device')).toBeInTheDocument();
    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('Android 12')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('iOS 16.0')).toBeInTheDocument();

    userEvent.click(screen.getByText('device'));
    expect(screen.getByText('23%')).toBeInTheDocument();
    expect(screen.getByText('iPhone15')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('Android Phone')).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(screen.getByText('iPhone12')).toBeInTheDocument();

    userEvent.click(screen.getByText('release'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('org.mozilla.ios.Fennec@106.0')).toBeInTheDocument();
  });
});
