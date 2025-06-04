import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {PlatformOptionsControl} from 'sentry/components/onboarding/platformOptionsControl';

describe('Onboarding Product Selection', function () {
  const platformOptions: Record<string, PlatformOption> = {
    springBoot: {
      items: [
        {label: 'V2', value: 'v2'},
        {label: 'V3', value: 'v3'},
      ],
      label: 'Spring Boot',
    },
    packageManager: {
      items: [
        {label: 'Gradle', value: 'gradle'},
        {label: 'Maven', value: 'maven'},
      ],
      label: 'Package Manager',
    },
    language: {
      items: [
        {label: 'Java', value: 'java'},
        {label: 'Kotlin', value: 'kotlin'},
      ],
      label: 'Language',
    },
  };

  it('renders default state', function () {
    render(<PlatformOptionsControl platformOptions={platformOptions} />, {
      initialRouterConfig: {
        location: {
          pathname: '/mock-pathname/',
          query: {
            springBoot: 'v3',
            packageManager: 'something-else',
          },
        },
        route: '/mock-pathname/',
      },
    });

    // Find the Spring Boot option, preselected from the URL
    const springBootV3 = screen.getByRole('radio', {name: 'V3'});
    expect(springBootV3).toBeInTheDocument();
    expect(springBootV3).toBeChecked();

    const springBootV2 = screen.getByRole('radio', {name: 'V2'});
    expect(springBootV2).toBeInTheDocument();
    expect(springBootV2).not.toBeChecked();

    // The pacakge manger control will fallback to the first option as the value in the URL is not valid
    const packageManagerGradle = screen.getByRole('radio', {name: 'Gradle'});
    expect(packageManagerGradle).toBeInTheDocument();
    expect(packageManagerGradle).toBeChecked();

    const packageManagerMaven = screen.getByRole('radio', {name: 'Maven'});
    expect(packageManagerMaven).toBeInTheDocument();
    expect(packageManagerMaven).not.toBeChecked();

    // The language control will fallback to the first option as it is not present in the URL
    const languageJava = screen.getByRole('radio', {name: 'Java'});
    expect(languageJava).toBeInTheDocument();
    expect(languageJava).toBeChecked();

    const languageKotlin = screen.getByRole('radio', {name: 'Maven'});
    expect(languageKotlin).toBeInTheDocument();
    expect(languageKotlin).not.toBeChecked();
  });

  it('updates the url on change', async function () {
    const {router} = render(
      <PlatformOptionsControl platformOptions={platformOptions} />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname/',
            query: {
              springBoot: 'v3',
              packageManager: 'gradle',
            },
          },
          route: '/mock-pathname/',
        },
      }
    );

    const springBootV3 = screen.getByRole('radio', {name: 'V3'});
    expect(springBootV3).toBeInTheDocument();
    expect(springBootV3).toBeChecked();

    const springBootV2 = screen.getByRole('radio', {name: 'V2'});
    expect(springBootV2).toBeInTheDocument();
    expect(springBootV2).not.toBeChecked();

    await userEvent.click(springBootV2);

    expect(router.location).toEqual(
      expect.objectContaining({
        query: {
          springBoot: 'v2',
          packageManager: 'gradle',
        },
      })
    );
  });

  it('triggers onChange callback', async function () {
    const handleChange = jest.fn();

    render(
      <PlatformOptionsControl
        platformOptions={platformOptions}
        onChange={handleChange}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/mock-pathname',
            query: {
              springBoot: 'v3',
              packageManager: 'gradle',
            },
          },
          route: '/mock-pathname/',
        },
      }
    );

    await userEvent.click(screen.getByRole('radio', {name: 'V2'}));
    expect(handleChange).toHaveBeenCalledWith({springBoot: 'v2'});
  });
});
