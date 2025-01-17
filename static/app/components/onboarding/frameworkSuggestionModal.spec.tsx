import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import platforms from 'sentry/data/platforms';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import {
  FrameworkSuggestionModal,
  languageDescriptions,
  topJavascriptFrameworks,
} from './frameworkSuggestionModal';

describe('Framework suggestion modal', function () {
  it('render default components', function () {
    const {organization} = initializeOrg();
    const closeModal = jest.fn();

    const selectedPlatform: OnboardingSelectedSDK = {
      key: 'javascript',
      language: 'javascript',
      category: 'browser',
      type: 'language',
      link: 'https://docs.sentry.io/platforms/',
      name: 'JavaScript',
    };

    render(
      <FrameworkSuggestionModal
        Body={ModalBody}
        Header={makeClosableHeader(jest.fn())}
        closeModal={closeModal}
        CloseButton={makeCloseButton(jest.fn())}
        Footer={ModalFooter}
        onConfigure={jest.fn()}
        onSkip={jest.fn()}
        organization={organization}
        selectedPlatform={selectedPlatform}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Do you use a framework?'})
    ).toBeInTheDocument();

    expect(screen.getByText(languageDescriptions.javascript!)).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: `Nope, Vanilla`})).toBeChecked();

    const frameworks = platforms.filter(
      platform => platform.type === 'framework' && platform.language === 'javascript'
    );

    for (const framework of frameworks) {
      expect(screen.getByRole('radio', {name: framework.name})).toBeInTheDocument();
    }

    // check that the top frameworks are in the correct order
    topJavascriptFrameworks.forEach((framework, index) => {
      const name = frameworks.find(f => f.id === framework)?.name;
      if (name) {
        expect(screen.getAllByRole('listitem')[index + 1]).toHaveTextContent(name);
      }
    });

    expect(screen.getByRole('button', {name: 'Configure SDK'})).toBeEnabled();
  });
});
