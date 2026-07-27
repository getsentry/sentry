import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {
  PROJECT_CREATION_ORIGIN_ORG_CREATION,
  PROJECT_CREATION_ORIGIN_QUERY_KEY,
  resolveProjectCreationPageOrigin,
  useProjectCreationPageOrigin,
} from 'sentry/views/projectInstall/projectCreationOrigin';

describe('resolveProjectCreationPageOrigin', () => {
  beforeEach(() => {
    sessionStorageWrapper.clear();
  });

  it('returns org_creation from the query seed without writing storage', () => {
    // Pure read: the sticky write lives in the hook, not the resolver.
    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'acme',
        queryValue: PROJECT_CREATION_ORIGIN_ORG_CREATION,
      })
    ).toBe('org_creation');

    expect(sessionStorageWrapper.getItem('project-creation-origin:acme')).toBeNull();
  });

  it('returns sticky org_creation from storage when the seed is gone', () => {
    // Simulates the getting-started autofill return: storage set on a prior
    // land, URL now only carries referrer (no origin seed).
    sessionStorageWrapper.setItem(
      'project-creation-origin:acme',
      PROJECT_CREATION_ORIGIN_ORG_CREATION
    );

    expect(
      resolveProjectCreationPageOrigin({orgSlug: 'acme', queryValue: undefined})
    ).toBe('org_creation');
  });

  it('defaults to existing_org with no seed and empty storage', () => {
    expect(
      resolveProjectCreationPageOrigin({orgSlug: 'acme', queryValue: undefined})
    ).toBe('existing_org');
  });

  it('does not treat other query values as org creation', () => {
    expect(
      resolveProjectCreationPageOrigin({orgSlug: 'acme', queryValue: 'getting-started'})
    ).toBe('existing_org');
  });

  it('scopes sticky origin per org slug', () => {
    sessionStorageWrapper.setItem(
      'project-creation-origin:acme',
      PROJECT_CREATION_ORIGIN_ORG_CREATION
    );

    expect(
      resolveProjectCreationPageOrigin({orgSlug: 'other-org', queryValue: undefined})
    ).toBe('existing_org');
  });

  it('exports the query key used by org-create redirect', () => {
    // Guard against silent drift between the redirect builder and the reader.
    expect(PROJECT_CREATION_ORIGIN_QUERY_KEY).toBe('projectCreationOrigin');
  });
});

describe('useProjectCreationPageOrigin', () => {
  const organization = OrganizationFixture({slug: 'acme'});

  beforeEach(() => {
    sessionStorageWrapper.clear();
  });

  function renderOrigin(query: Record<string, string> = {}) {
    return renderHookWithProviders(useProjectCreationPageOrigin, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/acme/projects/new/', query},
      },
    });
  }

  it('stickies the seed into sessionStorage and returns org_creation', async () => {
    const {result} = renderOrigin({
      [PROJECT_CREATION_ORIGIN_QUERY_KEY]: PROJECT_CREATION_ORIGIN_ORG_CREATION,
    });

    expect(result.current).toBe('org_creation');
    await waitFor(() => {
      expect(sessionStorageWrapper.getItem('project-creation-origin:acme')).toBe(
        PROJECT_CREATION_ORIGIN_ORG_CREATION
      );
    });
  });

  it('keeps org_creation sticky on a bare autofill return', () => {
    // Prior land already stickied origin for this org.
    sessionStorageWrapper.setItem(
      'project-creation-origin:acme',
      PROJECT_CREATION_ORIGIN_ORG_CREATION
    );

    const {result} = renderOrigin({referrer: 'getting-started', project: '123'});

    expect(result.current).toBe('org_creation');
  });

  it('defaults to existing_org and writes nothing without a seed', () => {
    const {result} = renderOrigin();

    expect(result.current).toBe('existing_org');
    expect(sessionStorageWrapper.getItem('project-creation-origin:acme')).toBeNull();
  });
});
