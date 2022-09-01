import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {SpecifyClientRateModal} from 'sentry/views/settings/project/server-side-sampling/modals/specifyClientRateModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData} from '../testUtils';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('Server-Side Sampling - Specify Client Rate Modal', function () {
  it('renders', async function () {
    const {organization, project} = getMockData();
    const handleReadDocs = jest.fn();
    const handleGoNext = jest.fn();
    const handleChange = jest.fn();

    const {container} = render(<GlobalModal />);

    openModal(modalProps => (
      <SpecifyClientRateModal
        {...modalProps}
        organization={organization}
        onReadDocs={handleReadDocs}
        projectId={project.id}
        onGoNext={handleGoNext}
        value={undefined}
        onChange={handleChange}
      />
    ));

    // Header
    expect(
      await screen.findByRole('heading', {
        name: 'Specify current client(SDK) sample rate',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Find the tracesSampleRate option in your SDK config, and copy it’s value into the field below.'
        )
      )
    ).toBeInTheDocument();

    // Content
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    expect(container).toSnapshot();

    // Hover over next button
    userEvent.hover(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Sample rate is not valid')).toBeInTheDocument();

    // Enter valid specified client-sample rate
    userEvent.type(screen.getByRole('spinbutton'), '0.2{enter}');
    expect(handleChange).toHaveBeenCalled();

    // Click on the docs
    userEvent.click(screen.getByLabelText('Read Docs'));
    expect(handleReadDocs).toHaveBeenCalled();

    // Click on cancel button
    userEvent.click(screen.getByLabelText('Cancel'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Cancel'));
  });
});
