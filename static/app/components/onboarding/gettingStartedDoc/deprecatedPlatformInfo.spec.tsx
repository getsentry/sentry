import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {DeprecatedPlatformInfo} from 'sentry/components/onboarding/gettingStartedDoc/deprecatedPlatformInfo';
import type {PlatformIntegration} from 'sentry/types/project';

describe('DeprecatedPlatformInfo', () => {
  it('renders correctly', () => {
    const dsn = ProjectKeysFixture()[0]!.dsn;
    const platform: PlatformIntegration = {
      id: 'python-pymongo',
      name: 'PyMongo',
      type: 'library',
      language: 'python',
      link: 'https://docs.sentry.io/platforms/python/guides/pymongo/',
      deprecated: true,
    };

    render(<DeprecatedPlatformInfo platform={platform} dsn={dsn} />);

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          `${platform.name} has been deprecated, but you can still use this project with the following DSN:`
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByText(dsn.public)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Copy snippet/i})).toBeInTheDocument();
    const docsLink = screen.getByRole('link', {name: 'docs'});
    expect(docsLink).toHaveAttribute('href', platform.link);
    const fullListLink = screen.getByRole('link', {name: 'full list'});
    expect(fullListLink).toHaveAttribute('href', 'https://docs.sentry.io/platforms/');
  });
});
