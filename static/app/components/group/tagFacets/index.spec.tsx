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
              value: 'org.mozilla.ios.Fennec@106.0',
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
              value: 'iOS 16.0',
              count: 10,
            },
          ],
        },
        device: {
          key: 'device',
          topValues: [
            {
              name: 'iPhone15',
              value: 'iPhone15',
              count: 7,
            },
            {
              name: 'Android Phone',
              value: 'Android Phone',
              count: 10,
            },
            {
              name: 'iPhone12',
              value: 'iPhone12',
              count: 13,
            },
            {
              name: 'iPhone11',
              value: 'iPhone11',
              count: 15,
            },
            {
              name: 'iPhone10',
              value: 'iPhone10',
              count: 18,
            },
            {
              name: 'Other device',
              value: 'Other device',
              count: 2,
            },
          ],
        },
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Tag Bars', function () {
    it('does not display anything if no tag values recieved', async function () {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {},
      });
      render(
        <TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} style="bars" />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });
      expect(screen.queryByText('os')).not.toBeInTheDocument();
      expect(screen.queryByText('device')).not.toBeInTheDocument();
      expect(screen.queryByText('release')).not.toBeInTheDocument();
    });

    it('displays os, device, and release tags', async function () {
      render(
        <TagFacets environments={[]} groupId="1" tagKeys={MOBILE_TAGS} style="bars" />,
        {
          organization,
        }
      );
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
      expect(screen.getByText('11%')).toBeInTheDocument();
      expect(screen.getByText('iPhone15')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
      expect(screen.getByText('Android Phone')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
      expect(screen.getByText('iPhone12')).toBeInTheDocument();
      expect(screen.getByText('23%')).toBeInTheDocument();
      expect(screen.getByText('iPhone11')).toBeInTheDocument();
      expect(screen.getByText('28%')).toBeInTheDocument();
      expect(screen.getByText('iPhone10')).toBeInTheDocument();

      userEvent.click(screen.getByText('release'));
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('org.mozilla.ios.Fennec@106.0')).toBeInTheDocument();
    });

    it('shows tooltip', async function () {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          event={{tags: [{key: 'os', value: 'Android 12'}]} as Event}
          style="bars"
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
          screen.getByText('The tag value of the current event.')
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
          style="bars"
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

    it('renders a Show All Tags button to navigate to the tags page', async () => {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="bars"
        />,
        {
          organization,
        }
      );
      expect(await screen.findByRole('button', {name: 'Show All Tags'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/1/tags/'
      );
    });

    it('renders a tag value bars that link to the tag', async () => {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="bars"
        />,
        {
          organization,
        }
      );
      expect(
        await screen.findByRole('link', {
          name: 'Add Android 12 to the search query',
        })
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/1/tags/os/?referrer=tag-distribution-meter'
      );
    });

    it('renders readable device name when available', async () => {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {
          device: {
            key: 'device',
            topValues: [
              {
                name: 'abcdef123456',
                value: 'abcdef123456',
                readable: 'Galaxy S22',
                count: 2,
              },
            ],
          },
        },
      });
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="bars"
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });

      userEvent.click(screen.getByText('device'));
      expect(screen.getByText('Galaxy S22')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('does not duplicate release values with same name', async function () {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {
          release: {
            key: 'release',
            topValues: [
              {
                name: '1.0',
                value: 'something@1.0',
                count: 30,
              },
              {
                name: '1.0',
                value: '1.0',
                count: 10,
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
            ],
          },
        },
      });

      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="bars"
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });

      expect(screen.getByText('Android 12')).toBeInTheDocument();
      userEvent.click(screen.getByText('release'));
      expect(screen.getAllByText('1.0')).toHaveLength(2);

      // Test that the tag isn't being duplicated to the os tab
      userEvent.click(screen.getByText('os'));
      expect(screen.queryByText('1.0')).not.toBeInTheDocument();

      // Test that the tag hasn't been duplicated in the release tab
      userEvent.click(screen.getByText('release'));
      expect(screen.getAllByText('1.0')).toHaveLength(2);
    });
  });

  describe('Tag Breakdowns', function () {
    it('does not display anything if no tag values recieved', async function () {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {},
      });
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          style="breakdowns"
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });
      expect(screen.queryByText('os')).not.toBeInTheDocument();
      expect(screen.queryByText('device')).not.toBeInTheDocument();
      expect(screen.queryByText('release')).not.toBeInTheDocument();
    });

    it('displays os, device, and release tags', async function () {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          style="breakdowns"
        />,
        {
          organization,
        }
      );
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

    it('shows tooltip', async function () {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          event={{tags: [{key: 'os', value: 'Android 12'}]} as Event}
          style="breakdowns"
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
          screen.getByText('The tag value of the current event.')
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
          style="breakdowns"
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
          style="breakdowns"
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
          style="breakdowns"
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
          style="breakdowns"
        />,
        {
          organization,
        }
      );
      userEvent.click(await screen.findByText('release'));
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.queryByText('Other')).not.toBeInTheDocument();
    });

    it('renders readable device name when available', async () => {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {
          device: {
            key: 'device',
            topValues: [
              {
                name: 'abcdef123456',
                value: 'abcdef123456',
                readable: 'Galaxy S22',
                count: 2,
              },
            ],
          },
        },
      });
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="breakdowns"
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });

      userEvent.click(screen.getByText('device'));
      expect(screen.getByText('Galaxy S22')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('does not duplicate release values with same name', async function () {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {
          release: {
            key: 'release',
            topValues: [
              {
                name: '1.0',
                value: 'something@1.0',
                count: 30,
              },
              {
                name: '1.0',
                value: '1.0',
                count: 10,
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
            ],
          },
        },
      });

      render(
        <TagFacets
          environments={[]}
          groupId="1"
          tagKeys={MOBILE_TAGS}
          tagFormatter={MOBILE_TAGS_FORMATTER}
          style="breakdowns"
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });

      expect(screen.getByText('Android 12')).toBeInTheDocument();
      userEvent.click(screen.getByText('release'));
      expect(screen.getAllByText('1.0')).toHaveLength(2);

      // Test that the tag isn't being duplicated to the os tab
      userEvent.click(screen.getByText('os'));
      expect(screen.queryByText('1.0')).not.toBeInTheDocument();

      // Test that the tag hasn't been duplicated in the release tab
      userEvent.click(screen.getByText('release'));
      expect(screen.getAllByText('1.0')).toHaveLength(2);
    });
  });
});
