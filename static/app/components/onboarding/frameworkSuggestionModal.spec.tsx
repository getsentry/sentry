import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import platforms from 'sentry/data/platforms';

import {
  FrameworkSuggestionModal,
  languageDescriptions,
  topJavascriptFrameworks,
} from './frameworkSuggestionModal';

describe('Framework suggestion modal', function () {
  it('render default components', async function () {
    const {organization} = initializeOrg();
    const closeModal = jest.fn();

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
        selectedPlatform={{
          key: 'javascript',
          language: 'javascript',
          category: 'browser',
          type: 'language',
        }}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Do you use a framework?'})
    ).toBeInTheDocument();

    expect(screen.getByText(languageDescriptions.javascript)).toBeInTheDocument();

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
        expect(screen.getAllByRole('listitem')[index]).toHaveTextContent(name);
      }
    });

    expect(screen.getByRole('button', {name: 'Configure SDK'})).toBeDisabled();

    await userEvent.hover(screen.getByRole('button', {name: 'Configure SDK'}));
    expect(
      await screen.findByText('Select a framework to configure')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: frameworks[0].name}));

    expect(screen.getByRole('button', {name: 'Configure SDK'})).toBeEnabled();

    await userEvent.click(screen.getByRole('button', {name: 'Skip'}));
    await waitFor(() => {
      expect(closeModal).toHaveBeenCalled();
    });
  });
});
