import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  CommandPaletteProvider,
  useCommandPaletteActions as useRegisteredActions,
} from 'sentry/components/commandPalette/context';
import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';

const org = OrganizationFixture({features: ['cmd-k-dsn-lookup']});

function DsnLookupHarness({query}: {query: string}) {
  useDsnLookupActions(query);
  const actions = useRegisteredActions();

  return (
    <ul>
      {actions.map(action => (
        <li
          key={action.key}
          data-type={action.type}
          data-to={'to' in action ? action.to : undefined}
        >
          {action.display.label}
        </li>
      ))}
    </ul>
  );
}

function renderWithProvider(query: string) {
  return render(
    <CommandPaletteProvider>
      <DsnLookupHarness query={query} />
    </CommandPaletteProvider>,
    {organization: org}
  );
}

describe('useDsnLookupActions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns actions for a valid DSN', async () => {
    const dsn = 'https://abc123def456abc123def456abc123de@o1.ingest.sentry.io/123';
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/dsn-lookup/`,
      body: {
        organizationSlug: 'test-org',
        projectSlug: 'test-project',
        projectId: '42',
        projectName: 'Test Project',
        projectPlatform: 'javascript',
        keyLabel: 'Default',
        keyId: '1',
      },
      match: [MockApiClient.matchQuery({dsn})],
    });

    renderWithProvider(dsn);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    expect(items[0]).toHaveAttribute('data-type', 'navigate');
    expect(items[0]).toHaveAttribute(
      'data-to',
      '/organizations/test-org/issues/?project=42'
    );

    expect(items[1]).toHaveAttribute('data-type', 'navigate');
    expect(items[1]).toHaveAttribute(
      'data-to',
      '/settings/test-org/projects/test-project/'
    );

    expect(items[2]).toHaveAttribute('data-type', 'navigate');
    expect(items[2]).toHaveAttribute(
      'data-to',
      '/settings/test-org/projects/test-project/keys/'
    );
  });

  it('returns empty array for non-DSN query', () => {
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/dsn-lookup/`,
      body: {},
    });

    renderWithProvider('some random text');

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('returns empty array for empty query', () => {
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/dsn-lookup/`,
      body: {},
    });

    renderWithProvider('');

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(mockApi).not.toHaveBeenCalled();
  });
});
