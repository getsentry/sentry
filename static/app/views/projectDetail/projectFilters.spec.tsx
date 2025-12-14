import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectFilters from 'sentry/views/projectDetail/projectFilters';

describe('ProjectDetail > ProjectFilters', () => {
  const onSearch = jest.fn();
  const tagValueLoader = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    tagValueLoader.mockResolvedValue([
      {
        count: null,
        firstSeen: null,
        key: 'release.version',
        lastSeen: null,
        name: 'sentry@0.5.3',
        value: 'sentry@0.5.3',
      },
    ]);
  });

  it('recommends semver search tag', async () => {
    render(
      <ProjectFilters
        query=""
        onSearch={onSearch}
        tagValueLoader={tagValueLoader}
        relativeDateOptions={{}}
      />
    );

    await userEvent.click(
      screen.getByPlaceholderText('Search by release version, build, package, or stage')
    );

    // Should suggest all semver tags
    await screen.findByRole('option', {name: 'release'});
    expect(screen.getByRole('option', {name: 'release.build'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'release.package'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'release.stage'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'release.version'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: 'release.version'}));

    await screen.findByText('sentry@0.5.3');
  });
});
