import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagFacets, {TAGS_FORMATTER} from 'sentry/components/group/tagFacets';

const {organization} = initializeOrg();
describe('Tag Facets', function () {
  let tagsMock;
  const project = TestStubs.Project();
  project.platform = 'android';
  const tags = ['os', 'device', 'release'];

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
          totalValues: 30,
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
          totalValues: 30,
        },
        device: {
          key: 'device',
          topValues: [
            {
              name: 'iPhone10',
              value: 'iPhone10',
              count: 18,
            },
            {
              name: 'iPhone11',
              value: 'iPhone11',
              count: 15,
            },
            {
              name: 'iPhone12',
              value: 'iPhone12',
              count: 13,
            },
            {
              name: 'Android Phone',
              value: 'Android Phone',
              count: 10,
            },
            {
              name: 'iPhone15',
              value: 'iPhone15',
              count: 7,
            },
            {
              name: 'Other device',
              value: 'Other device',
              count: 2,
            },
          ],
          totalValues: 65,
        },
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Tag Distributions', function () {
    it('does not display anything if no tag values recieved', async function () {
      tagsMock = MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: {},
      });
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          project={project}
          tagKeys={tags}
          tagFormatter={TAGS_FORMATTER}
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
          project={project}
          tagKeys={tags}
          tagFormatter={TAGS_FORMATTER}
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });
      expect(screen.getByRole('listitem', {name: 'os'})).toBeInTheDocument();
      expect(screen.getByRole('listitem', {name: 'device'})).toBeInTheDocument();
      expect(screen.getByRole('listitem', {name: 'release'})).toBeInTheDocument();
    });

    it('expands first tag distribution by default', async function () {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          project={project}
          tagKeys={tags}
          tagFormatter={TAGS_FORMATTER}
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });
      expect(
        screen.getByRole('button', {name: 'Collapse os tag distribution'})
      ).toBeInTheDocument();
    });

    it('closes and expands tag distribution when tag header is clicked', async function () {
      render(
        <TagFacets
          environments={[]}
          groupId="1"
          project={project}
          tagKeys={tags}
          tagFormatter={TAGS_FORMATTER}
        />,
        {
          organization,
        }
      );
      await waitFor(() => {
        expect(tagsMock).toHaveBeenCalled();
      });
      expect(
        screen.getByRole('button', {name: 'Collapse os tag distribution'})
      ).toBeInTheDocument();
      userEvent.click(screen.getByRole('button', {name: 'Collapse os tag distribution'}));
      expect(
        screen.getByRole('button', {name: 'Expand os tag distribution'})
      ).toBeInTheDocument();
    });
  });
});
