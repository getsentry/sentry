import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  MOBILE_TAGS,
  MOBILE_TAGS_FORMATTER,
  TagFacets,
} from 'sentry/components/group/tagFacets';
import {Event} from 'sentry/types/event';

const {organization} = initializeOrg();
describe('Tag Facets', function () {
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
              value: 'Android 12',
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
            {
              name: 'iPhone11',
              count: 15,
            },
            {
              name: 'iPhone10',
              count: 18,
            },
            {
              name: 'Other device',
              count: 2,
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
    render(<TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} />, {
      organization,
    });
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('os')).not.toBeInTheDocument();
    expect(screen.queryByText('device')).not.toBeInTheDocument();
    expect(screen.queryByText('release')).not.toBeInTheDocument();
  });

  it('displays os, device, and release tags', async function () {
    render(<TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} />, {
      organization,
    });
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });
    expect(screen.getByText('os')).toBeInTheDocument();
    expect(screen.getByText('device')).toBeInTheDocument();
    expect(screen.getByText('release')).toBeInTheDocument();
    expect(screen.getByText('66%')).toBeInTheDocument();
    expect(screen.getByText('Android 12')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('iOS 16.0')).toBeInTheDocument();

    userEvent.click(screen.getByText('device'));
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('iPhone15')).toBeInTheDocument();
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('Android Phone')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('iPhone12')).toBeInTheDocument();
    expect(screen.getByText('23%')).toBeInTheDocument();
    expect(screen.getByText('iPhone11')).toBeInTheDocument();
    expect(screen.getByText('27%')).toBeInTheDocument();
    expect(screen.getByText('iPhone10')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();

    userEvent.click(screen.getByText('release'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('org.mozilla.ios.Fennec@106.0')).toBeInTheDocument();
  });

  // Skipping because this behaviour will be re-introduced
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('shows tooltip', async function () {
    render(
      <TagFacets
        environments={[]}
        groupId="1"
        tagKeys={MOBILE_TAGS}
        event={{tags: [{key: 'os', value: 'Android 12'}]} as Event}
      />,
      {
        organization,
      }
    );
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });

    userEvent.hover(screen.getByText('Android 12'));
    await waitFor(() =>
      expect(
        screen.getByText('This is also the tag value of the error event you are viewing.')
      ).toBeInTheDocument()
    );
  });

  it('format tag values when given a tagFormatter', async function () {
    render(
      <TagFacets
        environments={[]}
        groupId="1"
        tagKeys={MOBILE_TAGS}
        tagFormatter={MOBILE_TAGS_FORMATTER}
      />,
      {
        organization,
      }
    );
    await waitFor(() => {
      expect(tagsMock).toHaveBeenCalled();
    });

    userEvent.click(screen.getByText('release'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('106.0')).toBeInTheDocument();
  });

  it('renders a View all button to navigate to the tags page', async () => {
    render(
      <TagFacets
        environments={[]}
        groupId="1"
        tagKeys={MOBILE_TAGS}
        tagFormatter={MOBILE_TAGS_FORMATTER}
      />,
      {
        organization,
      }
    );
    expect(await screen.findByRole('button', {name: 'View All Tags'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/tags/'
    );
  });

  it('renders a breakdown bar with segments that link to the tag', async () => {
    render(
      <TagFacets
        environments={[]}
        groupId="1"
        tagKeys={MOBILE_TAGS}
        tagFormatter={MOBILE_TAGS_FORMATTER}
      />,
      {
        organization,
      }
    );
    expect(
      await screen.findByRole('link', {
        name: 'Add the os Android 12 segment tag to the search query',
      })
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/tags/os/?referrer=tag-distribution-meter'
    );
  });

  it('does not render other if visible tags renders 100%', async () => {
    render(
      <TagFacets
        environments={[]}
        groupId="1"
        tagKeys={MOBILE_TAGS}
        tagFormatter={MOBILE_TAGS_FORMATTER}
      />,
      {
        organization,
      }
    );
    userEvent.click(await screen.findByText('release'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });
});
