import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import FeatureTourModal from 'sentry/components/modals/featureTourModal';
import ModalStore from 'sentry/stores/modalStore';

const steps = [
  {
    title: 'First',
    body: 'First step',
    image: <em data-test-id="step-image">Image</em>,
    actions: (
      <a href="#" data-test-id="step-action">
        additional action
      </a>
    ),
  },
  {title: 'Second', body: 'Second step'},
];

describe('FeatureTourModal', function () {
  let onAdvance!: jest.Mock;
  let onCloseModal!: jest.Mock;

  const createWrapper = (props = {}) =>
    render(
      <Fragment>
        <GlobalModal />
        <FeatureTourModal
          steps={steps}
          onAdvance={onAdvance}
          onCloseModal={onCloseModal}
          doneUrl="/done"
          {...props}
        >
          {({showModal}) => (
            <a href="#" onClick={showModal} data-test-id="reveal">
              Open
            </a>
          )}
        </FeatureTourModal>
      </Fragment>
    );

  async function clickModal() {
    await userEvent.click(screen.getByTestId('reveal'));
  }

  beforeEach(function () {
    ModalStore.reset();
    onAdvance = jest.fn();
    onCloseModal = jest.fn();
  });

  it('shows the modal on click', async function () {
    createWrapper();

    // No modal showing
    expect(screen.queryByTestId('feature-tour')).not.toBeInTheDocument();
    await clickModal();

    // Modal is now showing
    expect(screen.getByTestId('feature-tour')).toBeInTheDocument();
  });

  it('advances on click', async function () {
    createWrapper();

    await clickModal();

    // Should start on the first step.
    expect(screen.getByRole('heading')).toHaveTextContent(steps[0].title);

    // Advance to the next step.
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    // Should move to next step.
    expect(screen.getByRole('heading')).toHaveTextContent(steps[1].title);
    expect(onAdvance).toHaveBeenCalled();
  });

  it('shows step content', async function () {
    createWrapper();

    await clickModal();

    // Should show title, image and actions
    expect(screen.getByRole('heading')).toHaveTextContent(steps[0].title);
    expect(screen.getByTestId('step-image')).toBeInTheDocument();
    expect(screen.getByTestId('step-action')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('last step shows done', async function () {
    createWrapper();

    await clickModal();

    // Advance to the last step.
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    // Click the done
    await userEvent.click(screen.getByRole('button', {name: 'Complete tour'}));

    // Wait for the ModalStore action to propagate.
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('last step shows doneText and uses doneUrl', async function () {
    const props = {doneText: 'Finished', doneUrl: 'http://example.org'};
    createWrapper(props);

    await clickModal();

    // Advance to the last step.
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    // Ensure button looks right
    const button = screen.getByRole('button', {name: 'Complete tour'});
    expect(button).toHaveTextContent(props.doneText);
    expect(button).toHaveAttribute('href', props.doneUrl);

    // Click the done
    await userEvent.click(button);
    // Wait for the ModalStore action to propagate.
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('close button dismisses modal', async function () {
    createWrapper();

    await clickModal();

    await userEvent.click(screen.getByRole('button', {name: 'Close tour'}));

    // Wait for the ModalStore action to propagate.
    expect(onCloseModal).toHaveBeenCalled();
  });
});
