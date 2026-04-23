import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {FeatureShowcase, useShowcaseContext} from 'sentry/components/featureShowcase';
import {GlobalModal} from 'sentry/components/globalModal';

function CustomFooter() {
  const {close} = useShowcaseContext();
  return (
    <Flex justify="end">
      <LinkButton
        external
        href="http://example.org"
        onClick={close}
        priority="primary"
        aria-label="Complete tour"
      >
        Finished
      </LinkButton>
    </Flex>
  );
}

describe('FeatureShowcase', () => {
  let onStepChange!: jest.Mock;

  function openTestShowcase() {
    openModal(deps => (
      <FeatureShowcase {...deps} onStepChange={onStepChange}>
        <FeatureShowcase.Step>
          <FeatureShowcase.Image
            src="step-image.svg"
            alt="Step image"
            data-test-id="step-image"
          />
          <FeatureShowcase.StepTitle>First</FeatureShowcase.StepTitle>
          <FeatureShowcase.StepContent>First step</FeatureShowcase.StepContent>
          <FeatureShowcase.StepActions>
            <a href="#" data-test-id="step-action">
              additional action
            </a>
          </FeatureShowcase.StepActions>
        </FeatureShowcase.Step>
        <FeatureShowcase.Step>
          <FeatureShowcase.StepTitle>Second</FeatureShowcase.StepTitle>
          <FeatureShowcase.StepContent>Second step</FeatureShowcase.StepContent>
          <FeatureShowcase.StepActions />
        </FeatureShowcase.Step>
      </FeatureShowcase>
    ));
  }

  beforeEach(() => {
    onStepChange = jest.fn();
  });

  it('shows the modal', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    expect(screen.queryByTestId('feature-showcase')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('reveal'));

    expect(screen.getByTestId('feature-showcase')).toBeInTheDocument();
  });

  it('advances on click', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    expect(screen.getByRole('heading')).toHaveTextContent('First');

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByRole('heading')).toHaveTextContent('Second');
    expect(onStepChange).toHaveBeenCalled();
  });

  it('does not show back button on first step', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    expect(screen.queryByRole('button', {name: 'Back'})).not.toBeInTheDocument();
  });

  it('goes back on click', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByRole('heading')).toHaveTextContent('Second');
    expect(screen.getByRole('button', {name: 'Back'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(screen.getByRole('heading')).toHaveTextContent('First');
    expect(screen.queryByRole('button', {name: 'Back'})).not.toBeInTheDocument();
  });

  it('shows step content', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    expect(screen.getByRole('heading')).toHaveTextContent('First');
    expect(screen.getByTestId('step-image')).toBeInTheDocument();
    expect(screen.getByTestId('step-action')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('last step shows done', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await userEvent.click(screen.getByRole('button', {name: 'Complete tour'}));

    expect(onStepChange).toHaveBeenCalledTimes(1);
  });

  it('supports custom footer on last step', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button
          data-test-id="reveal"
          onClick={() => {
            openModal(deps => (
              <FeatureShowcase {...deps} onStepChange={onStepChange}>
                <FeatureShowcase.Step>
                  <FeatureShowcase.StepTitle>First</FeatureShowcase.StepTitle>
                  <FeatureShowcase.StepContent>First step</FeatureShowcase.StepContent>
                  <FeatureShowcase.StepActions />
                </FeatureShowcase.Step>
                <FeatureShowcase.Step>
                  <FeatureShowcase.StepTitle>Second</FeatureShowcase.StepTitle>
                  <FeatureShowcase.StepContent>Second step</FeatureShowcase.StepContent>
                  <CustomFooter />
                </FeatureShowcase.Step>
              </FeatureShowcase>
            ));
          }}
        >
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    const button = screen.getByRole('button', {name: 'Complete tour'});
    expect(button).toHaveTextContent('Finished');
    expect(button).toHaveAttribute('href', 'http://example.org');

    await userEvent.click(button);
  });

  it('close button dismisses modal', async () => {
    render(
      <Fragment>
        <GlobalModal />
        <button data-test-id="reveal" onClick={openTestShowcase}>
          Open
        </button>
      </Fragment>
    );

    await userEvent.click(screen.getByTestId('reveal'));

    await userEvent.click(screen.getByRole('button', {name: 'Close tour'}));
  });
});
