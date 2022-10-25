import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectFilters from 'sentry/views/projectDetail/projectFilters';

describe('ProjectDetail > ProjectFilters', () => {
  const onSearch = jest.fn();
  const tagValueLoader = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('recommends semver search tag', async () => {
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
    render(
      <ProjectFilters query="" onSearch={onSearch} tagValueLoader={tagValueLoader} />,
      {context: TestStubs.routerContext()}
    );

    userEvent.click(screen.getByRole('textbox'));

    // Should suggest all semver tags
    await screen.findByText('release');
    expect(screen.getByText('.build')).toBeInTheDocument();
    expect(screen.getByText('.package')).toBeInTheDocument();
    expect(screen.getByText('.stage')).toBeInTheDocument();
    expect(screen.getByText('.version')).toBeInTheDocument();

    userEvent.type(screen.getByRole('textbox'), 'release.version:');

    await screen.findByText('sentry@0.5.3');
  });
});
