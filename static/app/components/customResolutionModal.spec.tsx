import styled from '@emotion/styled';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from '@sentry/scraps/modal';

import {CustomResolutionModal} from 'sentry/components/customResolutionModal';
import {ConfigStore} from 'sentry/stores/configStore';

describe('CustomResolutionModal', () => {
  const project = ProjectFixture({id: '1', slug: 'project-slug'});
  let releasesMock: any;
  beforeEach(() => {
    ConfigStore.init();
    releasesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture({authors: [UserFixture()]})],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  const wrapper = styled((p: any) => p.children);

  it('can select a version', async () => {
    const onSelected = jest.fn();
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={onSelected}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );
    expect(releasesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {project: '1', query: ''}})
    );

    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    const option = await screen.findByRole('option', {name: /1\.2\.0/});
    await userEvent.click(option);

    expect(screen.getByRole('link', {name: /view release/i})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/releases/sentry-android-shop%401.2.0/?project=1'
    );

    await userEvent.click(screen.getByText('Resolve'));
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });

  it('queries organization releases without a project', async () => {
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={undefined}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    await waitFor(() =>
      expect(releasesMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({query: {query: ''}})
      )
    );
  });

  it('indicates which releases had commits from the user', async () => {
    const user = UserFixture();
    ConfigStore.set('user', user);
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );
    expect(releasesMock).toHaveBeenCalled();

    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    expect(await screen.findByText(/You committed/)).toBeInTheDocument();
  });

  it('indicates if the release is semver or timestamp', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        // Timestamp release
        ReleaseFixture({
          version: 'frontend@abcdef',
          versionInfo: {
            buildHash: null,
            description: '...',
            package: '',
            version: {raw: 'abcdef'},
          },
        }),
        // Semver release
        ReleaseFixture({
          version: 'frontend@1.2.3',
          versionInfo: {
            buildHash: null,
            description: '...',
            package: '',
            version: {
              raw: '1.2.3',
              major: 1,
              minor: 2,
              patch: 3,
              buildCode: null,
              components: 3,
            },
          },
        }),
      ],
    });
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    expect(
      await screen.findByRole('option', {name: 'abcdef (non-semver)'})
    ).toBeInTheDocument();
    expect(screen.getByRole('option', {name: '1.2.3 (semver)'})).toBeInTheDocument();
  });

  it('treats a release without version info as non-semver', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        ReleaseFixture({
          version: 'legacy-release',
          versionInfo: null,
        }),
      ],
    });

    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /version/i}));

    expect(
      await screen.findByRole('option', {name: 'legacy-release (non-semver)'})
    ).toBeInTheDocument();
  });

  it('ignores a collection response from an exact release lookup', async () => {
    const exactReleaseMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/.0/',
      body: [ReleaseFixture({version: 'unexpected-collection-release'})],
    });

    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /version/i}));
    const searchInput = await screen.findByRole('textbox');
    await userEvent.click(searchInput);
    await userEvent.paste('.0');

    await waitFor(() => expect(exactReleaseMock).toHaveBeenCalled());
    expect(await screen.findByRole('option', {name: /1\.2\.0/})).toBeInTheDocument();
    expect(screen.queryByText('unexpected-collection-release')).not.toBeInTheDocument();
  });

  it('shows an inline error when submitting with no selection', async () => {
    const onSelected = jest.fn();
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={onSelected}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /resolve/i}));
    expect(await screen.findByText('Please select a release.')).toBeInTheDocument();
    expect(onSelected).not.toHaveBeenCalled();

    // selecting clears the error
    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    const option = await screen.findByRole('option', {name: /1\.2\.0/});
    await userEvent.click(option);
    expect(screen.queryByText('Please select a release.')).not.toBeInTheDocument();
  });

  it('prepends exact-match release even if not in list and avoids duplicates', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      match: [MockApiClient.matchQuery({query: 'search-me@3.0.0'})],
      body: [ReleaseFixture({version: 'other@2.0.0'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent('search-me@3.0.0')}/`,
      body: ReleaseFixture({version: 'search-me@3.0.0'}),
    });

    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    const searchInput = await screen.findByRole('textbox');
    await userEvent.click(searchInput);
    await userEvent.paste('search-me@3.0.0');

    expect(
      await screen.findByRole('option', {name: /sentry-android-shop.*3\.0\.0/i})
    ).toBeInTheDocument();

    // Ensure no duplicates
    const matches = screen.getAllByRole('option', {
      name: /sentry-android-shop.*3\.0\.0/i,
    });
    expect(matches).toHaveLength(1);
  });

  it('keeps showing a selected exact-match release after search is cleared', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent('ancient-release')}/`,
      body: ReleaseFixture({
        version: 'ancient-release',
        versionInfo: {
          buildHash: null,
          description: 'ancient-release',
          package: '',
          version: {
            raw: 'ancient-release',
          },
        },
      }),
    });

    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        project={project}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    const trigger = screen.getByRole('button', {name: /version/i});
    await userEvent.click(trigger);
    const searchInput = await screen.findByRole('textbox');
    await userEvent.click(searchInput);
    await userEvent.paste('ancient-release');

    expect(
      await screen.findByRole('option', {name: /ancient-release/})
    ).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    await waitFor(
      () =>
        expect(screen.getByRole('button', {name: /version/i})).toHaveTextContent(
          'ancient-release'
        ),
      {timeout: 600}
    );
  });
});
