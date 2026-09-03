import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ROOT_ELEMENT} from 'sentry/constants';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {captureSplashLoader, resetSplashLoader} from 'sentry/utils/splashLoader';
import {OrganizationContainer} from 'sentry/views/organizationContainer';

function makeReactRoot() {
  const rootEl = document.createElement('div');
  rootEl.id = ROOT_ELEMENT;
  rootEl.innerHTML =
    '<div class="splash-loader"><div data-test-id="loading-indicator">loading</div></div>';
  document.body.appendChild(rootEl);
  return rootEl;
}

describe('OrganizationContainer', () => {
  let rootEl: HTMLElement | undefined;

  beforeEach(() => {
    OrganizationStore.reset();
  });

  afterEach(() => {
    rootEl?.remove();
    rootEl = undefined;
    resetSplashLoader();
  });

  describe('loading', () => {
    it('re-parents the server-rendered loader', () => {
      rootEl = makeReactRoot();
      const indicator = rootEl.querySelector('[data-test-id="loading-indicator"]');
      captureSplashLoader(rootEl);

      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      // The node was moved, not copied — so there is exactly one of it, and it
      // is the very node the server rendered.
      expect(screen.getByTestId('loading-indicator')).toBe(indicator);
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('shows the loader again after an org switch, not a copy of the app', () => {
      rootEl = makeReactRoot();
      const indicator = rootEl.querySelector('[data-test-id="loading-indicator"]');
      captureSplashLoader(rootEl);

      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      act(() => {
        OrganizationStore.onUpdate(OrganizationFixture());
      });
      expect(screen.getByText('content')).toBeInTheDocument();

      // Simulate React having taken over the root with real app DOM. Reading
      // innerHTML here used to snapshot the whole previous org's UI.
      rootEl.innerHTML = '<main>previous org ui</main>';

      // An org switch resets the store back to loading
      act(() => {
        OrganizationStore.reset();
      });

      // Drop the stand-in root, so anything left in the document mentioning the
      // previous org can only be a copy the component made.
      rootEl.remove();

      expect(screen.queryByText('previous org ui')).not.toBeInTheDocument();
      expect(screen.getByTestId('loading-indicator')).toBe(indicator);
    });

    it('renders without throwing when no loader was captured', () => {
      expect(() =>
        render(
          <OrganizationContainer>
            <div>content</div>
          </OrganizationContainer>
        )
      ).not.toThrow();

      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });

  describe('loaded', () => {
    it('renders children once the organization resolves', () => {
      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      act(() => {
        OrganizationStore.onUpdate(OrganizationFixture());
      });

      expect(screen.getByText('content')).toBeInTheDocument();
    });
  });

  describe('errors', () => {
    it('renders children without an organization for ORG_NO_ACCESS', () => {
      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      act(() => {
        // 401 is what the store maps to ORG_NO_ACCESS
        OrganizationStore.onFetchOrgError({status: 401} as any);
      });

      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('renders a not-found alert for ORG_NOT_FOUND', () => {
      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      act(() => {
        OrganizationStore.onFetchOrgError({status: 404} as any);
      });

      expect(screen.getByTestId('org-loading-error')).toBeInTheDocument();
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });

    it('renders a generic loading error for other failures', () => {
      render(
        <OrganizationContainer>
          <div>content</div>
        </OrganizationContainer>
      );

      act(() => {
        OrganizationStore.onFetchOrgError({status: 500} as any);
      });

      expect(screen.getByText('There was an error loading data.')).toBeInTheDocument();
      expect(screen.queryByText('content')).not.toBeInTheDocument();
    });
  });
});
