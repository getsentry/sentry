import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReleasesDrawerTable} from './releasesDrawerTable';
import {ReleasesDrawerFields} from './utils';

const PAGE_LINKS =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/releases/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/releases/?cursor=0:15:0>; rel="next"; results="true"; cursor="0:15:0"';

function ExampleReleasesDrawerTable() {
  return (
    <ReleasesDrawerTable
      datetime={{period: '14d', start: null, end: null, utc: null}}
      environments={[]}
      projects={[1]}
      onMouseOverRelease={jest.fn()}
      onMouseOutRelease={jest.fn()}
    />
  );
}

describe('ReleasesDrawerTable', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        ReleaseFixture({
          version: '1.0.0',
          projects: [{...ReleaseFixture().projects[0]!, id: 3, newGroups: 0}],
        }),
      ],
      headers: {Link: PAGE_LINKS},
    });
  });

  it('links to the release in the drawer without cursors or the active repo when a release is listed', async () => {
    render(<ExampleReleasesDrawerTable />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/releases/',
          query: {
            project: '1',
            [ReleasesDrawerFields.DRAWER]: 'show',
            [ReleasesDrawerFields.LIST_CURSOR]: '0:15:0',
            [ReleasesDrawerFields.COMMIT_CURSOR]: 'a',
            [ReleasesDrawerFields.FILES_CURSOR]: 'b',
            [ReleasesDrawerFields.ACTIVE_REPO]: 'repo',
          },
        },
      },
    });

    const link = await screen.findByRole('link', {name: /1\.0\.0/});
    const {pathname, searchParams} = new URL(link.getAttribute('href')!, 'http://x');
    expect(pathname).toBe('/releases/');
    expect(Object.fromEntries(searchParams)).toEqual({
      project: '1',
      [ReleasesDrawerFields.DRAWER]: 'show',
      [ReleasesDrawerFields.RELEASE]: '1.0.0',
      [ReleasesDrawerFields.RELEASE_PROJECT_ID]: '3',
    });
  });

  it('pushes the list cursor when paginating', async () => {
    const onNuqsUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();
    const {router} = render(<ExampleReleasesDrawerTable />, {
      organization,
      onNuqsUrlUpdate,
      initialRouterConfig: {
        location: {
          pathname: '/releases/',
          query: {[ReleasesDrawerFields.DRAWER]: 'show'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    await waitFor(() =>
      expect(router.location.query[ReleasesDrawerFields.LIST_CURSOR]).toBe('0:15:0')
    );
    expect(router.location.query[ReleasesDrawerFields.DRAWER]).toBe('show');
    expect(onNuqsUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'push'})})
    );
  });
});
