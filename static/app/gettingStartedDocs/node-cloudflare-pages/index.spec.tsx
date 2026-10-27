import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {CloudflareSetupType} from 'sentry/gettingStartedDocs/node-cloudflare-workers/utils';

import {docs} from '.';

describe('legacy cloudflare-pages platform', () => {
  it('resolves to the merged Cloudflare docs', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
  });

  it('still offers the Pages setup', () => {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {setupType: CloudflareSetupType.PAGES},
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.sentryPagesPlugin\(/))
    ).toBeInTheDocument();
  });
});
