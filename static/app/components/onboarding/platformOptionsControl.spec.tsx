import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
    const {routerContext} = initializeOrg({
      router: {
        location: {
          query: {
            springBoot: 'v3',
            packageManager: 'something-else',
          },
        },
        params: {},
      },
    });

    render(<PlatformOptionsControl platformOptions={platformOptions} />, {
      context: routerContext,
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
    const {router, routerContext} = initializeOrg({
      router: {
        location: {
          query: {
            springBoot: 'v3',
            packageManager: 'gradle',
          },
        },
        params: {},
      },
    });

    render(<PlatformOptionsControl platformOptions={platformOptions} />, {
      context: routerContext,
    });

    const springBootV3 = screen.getByRole('radio', {name: 'V3'});
    expect(springBootV3).toBeInTheDocument();
    expect(springBootV3).toBeChecked();

    const springBootV2 = screen.getByRole('radio', {name: 'V2'});
    expect(springBootV2).toBeInTheDocument();
    expect(springBootV2).not.toBeChecked();

    await userEvent.click(springBootV2);

    expect(router.replace).toHaveBeenCalledWith({
      ...router.location,
      query: {
        springBoot: 'v2',
        packageManager: 'gradle',
      },
    });
  });
});
