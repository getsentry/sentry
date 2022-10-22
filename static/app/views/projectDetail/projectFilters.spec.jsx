import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';
import ProjectFilters from 'sentry/views/projectDetail/projectFilters';

describe('ProjectDetail > ProjectFilters', () => {
  const onSearch = jest.fn();
  const tagValueLoader = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('recommends semver search tag', async () => {
    const organization = Organization();
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
      <OrganizationContext.Provider value={organization}>
        <ProjectFilters query="" onSearch={onSearch} tagValueLoader={tagValueLoader} />
      </OrganizationContext.Provider>,
      {context: routerContext()}
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
