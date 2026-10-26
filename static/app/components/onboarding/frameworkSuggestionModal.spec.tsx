import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {openModal} from 'sentry/actionCreators/modal';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import * as analytics from 'sentry/utils/analytics';

import {
  FrameworkSuggestionModal,
  languageDescriptions,
  topJavascriptFrameworks,
} from './frameworkSuggestionModal';

jest.unmock('lodash/debounce');

describe('Framework suggestion modal', () => {
  const {organization} = initializeOrg();
  const selectedPlatform: OnboardingSelectedSDK = {
    key: 'javascript',
    language: 'javascript',
    category: 'browser',
    type: 'language',
    link: 'https://docs.sentry.io/platforms/',
    name: 'JavaScript',
  };

  it('render default components', async () => {
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
        selectedPlatform={selectedPlatform}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Do you use a framework?'})
    ).toBeInTheDocument();

    expect(screen.getByText(languageDescriptions.javascript!)).toBeInTheDocument();

    expect(screen.getByRole('radio', {name: 'Nope, Vanilla'})).toBeChecked();

    const frameworks = platforms.filter(
      platform => platform.type === 'framework' && platform.language === 'javascript'
    );

    await userEvent.click(screen.getByRole('button', {name: /Hidden Frameworks/}));

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

  it.each([false, true])(
    'focuses the Node selection and submits with Enter (choose framework: %s)',
    async chooseFramework => {
      const onSkip = jest.fn();
      const onConfigure = jest.fn();
      const onClose = jest.fn();
      const {waitForModalToHide} = renderGlobalModal();

      act(() =>
        openModal(
          modalProps => (
            <FrameworkSuggestionModal
              {...modalProps}
              onConfigure={onConfigure}
              onSkip={onSkip}
              organization={organization}
              selectedPlatform={{
                key: 'node',
                language: 'node',
                category: 'server',
                type: 'language',
                link: 'https://docs.sentry.io/platforms/javascript/guides/node',
                name: 'Node.js',
              }}
            />
          ),
          {onClose}
        )
      );

      expect(screen.getByRole('radio', {name: 'Nope, Vanilla'})).toBeChecked();
      await waitFor(() => {
        expect(screen.getByRole('radio', {name: 'Nope, Vanilla'})).toHaveFocus();
      });

      if (chooseFramework) {
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', {name: 'Express'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'Express'})).toHaveFocus();
        expect(screen.getByRole('radio', {name: 'Nope, Vanilla'})).not.toBeChecked();
      }
      expect(onSkip).not.toHaveBeenCalled();
      expect(onConfigure).not.toHaveBeenCalled();

      await userEvent.keyboard('{Enter}{Enter}');

      await waitFor(() => {
        expect(chooseFramework ? onConfigure : onSkip).toHaveBeenCalledTimes(1);
      });
      if (chooseFramework) {
        expect(onConfigure).toHaveBeenCalledWith(
          expect.objectContaining({key: 'node-express', name: 'Express'})
        );
        expect(onSkip).not.toHaveBeenCalled();
      } else {
        expect(onConfigure).not.toHaveBeenCalled();
      }
      expect(onClose).not.toHaveBeenCalled();

      await userEvent.keyboard('{Escape}');
      await waitForModalToHide();
      expect(onClose).toHaveBeenCalledWith('escape-key');
    }
  );

  it('tabs out of the radio group and closes with Enter without submitting', async () => {
    const onSkip = jest.fn();
    const onConfigure = jest.fn();
    const closeModal = jest.fn();
    render(
      <FrameworkSuggestionModal
        Body={ModalBody}
        Header={makeClosableHeader(closeModal)}
        closeModal={closeModal}
        CloseButton={makeCloseButton(closeModal)}
        Footer={ModalFooter}
        onConfigure={onConfigure}
        onSkip={onSkip}
        organization={organization}
        selectedPlatform={selectedPlatform}
      />
    );

    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Configure SDK'})).toHaveFocus();
    await userEvent.tab({shift: true});
    expect(screen.getByRole('radio', {name: 'Nope, Vanilla'})).toHaveFocus();
    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Close Modal'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onConfigure).not.toHaveBeenCalled();
  });

  it('expands hidden frameworks without submitting and confirms a hidden selection', async () => {
    const onSkip = jest.fn();
    const onConfigure = jest.fn();
    render(
      <FrameworkSuggestionModal
        Body={ModalBody}
        Header={makeClosableHeader(jest.fn())}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Footer={ModalFooter}
        onConfigure={onConfigure}
        onSkip={onSkip}
        organization={organization}
        selectedPlatform={selectedPlatform}
      />
    );

    expect(screen.queryByRole('radio', {name: 'Angular'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /Hidden Frameworks/}));
    expect(onSkip).not.toHaveBeenCalled();
    expect(onConfigure).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', {name: 'Angular'}));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(onConfigure).toHaveBeenCalledWith(
        expect.objectContaining({key: 'javascript-angular'})
      );
    });
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('should only call handleConfigure once on rapid multiple clicks', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const handleSkip = jest.fn();

    render(
      <FrameworkSuggestionModal
        Body={ModalBody}
        Header={makeClosableHeader(jest.fn())}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Footer={ModalFooter}
        onConfigure={jest.fn()}
        onSkip={handleSkip}
        organization={organization}
        selectedPlatform={selectedPlatform}
      />
    );

    const button = screen.getByRole('button', {name: 'Configure SDK'});

    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    expect(handleSkip).toHaveBeenCalledTimes(1);

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.select_framework_modal_skip_button_clicked',
      expect.objectContaining({variant: 'legacy'})
    );
  });

  it('adds the legacy variant to framework configuration analytics', async () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    render(
      <FrameworkSuggestionModal
        Body={ModalBody}
        Header={makeClosableHeader(jest.fn())}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Footer={ModalFooter}
        onConfigure={jest.fn()}
        onSkip={jest.fn()}
        organization={organization}
        selectedPlatform={selectedPlatform}
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'React'}));
    await userEvent.click(screen.getByRole('button', {name: 'Configure SDK'}));

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.select_framework_modal_configure_sdk_button_clicked',
      expect.objectContaining({variant: 'legacy'})
    );
  });
});
