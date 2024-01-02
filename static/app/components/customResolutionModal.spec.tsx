import selectEvent from 'react-select-event';
import styled from '@emotion/styled';
import {Organization} from 'sentry-fixture/organization';
import {Release as ReleaseFixture} from 'sentry-fixture/release';
import {User} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CustomResolutionModal from 'sentry/components/customResolutionModal';
import {makeCloseButton} from 'sentry/components/globalModal/components';
import ConfigStore from 'sentry/stores/configStore';

describe('CustomResolutionModal', () => {
  let releasesMock;
  const organization = Organization();
  beforeEach(() => {
    ConfigStore.init();
    releasesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [ReleaseFixture({authors: [User()]})],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  const wrapper = styled(p => p.children);

  it('can select a version', async () => {
    const onSelected = jest.fn();
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        organization={organization}
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );
    expect(releasesMock).toHaveBeenCalled();

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(await screen.findByText('1.2.0')).toBeInTheDocument();
    await userEvent.click(screen.getByText('1.2.0'));

    await userEvent.click(screen.getByText('Resolve'));
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });

  it('indicates which releases had commits from the user', async () => {
    const user = User();
    ConfigStore.set('user', user);
    render(
      <CustomResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        organization={organization}
        projectSlug="project-slug"
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );
    expect(releasesMock).toHaveBeenCalled();

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(await screen.findByText(/You committed/)).toBeInTheDocument();
  });

  it('indicates if the release is semver or timestamp', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
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
        organization={organization}
        projectSlug="project-slug"
        onSelected={jest.fn()}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    selectEvent.openMenu(screen.getByText('e.g. 1.0.4'));
    expect(
      await screen.findByRole('menuitemradio', {name: 'abcdef (non-semver)'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: '1.2.3 (semver)'})
    ).toBeInTheDocument();
  });
});
