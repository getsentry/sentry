import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {UniformRateModal} from 'sentry/views/settings/project/server-side-sampling/modals/uniformRateModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData} from '../utils';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('Server-Side Sampling - Uniform Rate Modal', function () {
  beforeAll(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats_v2/',
      body: TestStubs.Outcomes(),
    });
  });

  it('render next button', async function () {
    const {organization, project} = getMockData();
    const handleSubmit = jest.fn();
    const handleReadDocs = jest.fn();

    const {container} = render(<GlobalModal />);

    openModal(modalProps => (
      <UniformRateModal
        {...modalProps}
        organization={organization}
        project={project}
        projectStats={TestStubs.Outcomes()}
        rules={[]}
        onSubmit={handleSubmit}
        onReadDocs={handleReadDocs}
      />
    ));

    // Header
    expect(
      await screen.findByRole('heading', {
        name: 'Set a global sample rate',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'Set a server-side sample rate for all transactions using our suggestion as a starting point.'
        )
      )
    ).toBeInTheDocument();

    // Content
    expect(screen.getByText('Transactions (Last 30 days)')).toBeInTheDocument(); // Chart
    expect(screen.getByRole('radio', {name: 'Current'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Suggested'})).not.toBeChecked();
    expect(screen.getByText('100%')).toBeInTheDocument(); // Current client-side sample rate
    expect(screen.getByText('N/A')).toBeInTheDocument(); // Current server-side sample rate
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(95); // Suggested client-side sample rate
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(95); // Suggested server-side sample rate
    expect(screen.queryByLabelText('Reset to suggested values')).not.toBeInTheDocument();

    // Enter invalid client-side sample rate
    userEvent.clear(screen.getAllByRole('spinbutton')[0]);
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    // Hover over next button
    userEvent.hover(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Sample rate is not valid')).toBeInTheDocument();

    // Enter valid custom client-sample rate
    userEvent.type(screen.getAllByRole('spinbutton')[0], '20{enter}');
    expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(20); // Custom client-side sample rate
    expect(screen.getByRole('radio', {name: 'New'})).toBeChecked();
    expect(screen.getByLabelText('Reset to suggested values')).toBeInTheDocument();

    // Reset client-side sample rate to suggested value
    userEvent.click(screen.getByLabelText('Reset to suggested values'));
    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(95); // Suggested client-side sample rate

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();

    // Take screenshot (this is good as we can not test the chart)
    expect(container).toSnapshot();

    // Click on docs button
    userEvent.click(screen.getByRole('button', {name: 'Read Docs'}));
    expect(handleReadDocs).toHaveBeenCalled();
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'sampling.settings.modal.uniform.rate_read_docs',
      expect.objectContaining({
        organization,
        project_id: project.id,
      })
    );

    // Click on next button
    userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'sampling.settings.modal.uniform.rate_next',
      expect.objectContaining({
        organization,
        project_id: project.id,
      })
    );

    // Click on close button
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Close Modal'));
  });

  it('render done button', async function () {
    const {organization, project} = getMockData();
    const handleSubmit = jest.fn();

    const {container} = render(<GlobalModal />);

    openModal(modalProps => (
      <UniformRateModal
        {...modalProps}
        organization={organization}
        project={project}
        projectStats={{...TestStubs.Outcomes(), groups: []}}
        rules={[]}
        onSubmit={handleSubmit}
        onReadDocs={jest.fn()}
      />
    ));

    // Content
    const suggestedSampleRates = await screen.findAllByRole('spinbutton');
    expect(suggestedSampleRates[0]).toHaveValue(100); // Suggested client-side sample rate
    expect(suggestedSampleRates[1]).toHaveValue(100); // Suggested server-side sample rate
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'sampling.settings.modal.uniform.rate_switch_current',
      expect.objectContaining({
        organization,
        project_id: project.id,
      })
    );

    // Footer
    expect(screen.getByRole('button', {name: 'Done'})).toBeDisabled();
    expect(screen.queryByText('Step 1 of 2')).not.toBeInTheDocument();

    // Hover over done button
    userEvent.hover(screen.getByRole('button', {name: 'Done'}));
    expect(
      await screen.findByText('Current sampling values selected')
    ).toBeInTheDocument();

    // Switch to suggested sample rates
    userEvent.click(screen.getByText('Suggested'));
    expect(screen.getByRole('button', {name: 'Done'})).toBeEnabled();
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'sampling.settings.modal.uniform.rate_switch_recommended',
      expect.objectContaining({
        organization,
        project_id: project.id,
      })
    );

    // Take screenshot (this is good as we can not test the chart)
    expect(container).toSnapshot();

    // Submit
    userEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleRate: 1,
        recommendedSampleRate: true,
        uniformRateModalOrigin: true,
        rule: undefined,
      })
    );

    // Click on close button
    userEvent.click(screen.getByLabelText('Close Modal'));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Done'));
  });

  it('cancel flow', async function () {
    const {organization, project} = getMockData();

    render(<GlobalModal />);

    openModal(modalProps => (
      <UniformRateModal
        {...modalProps}
        organization={organization}
        project={project}
        projectStats={{...TestStubs.Outcomes(), groups: []}}
        rules={[]}
        onSubmit={jest.fn()}
        onReadDocs={jest.fn()}
      />
    ));

    await screen.findByRole('heading', {name: 'Set a global sample rate'});

    // Cancel
    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Cancel'));

    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
      'sampling.settings.modal.uniform.rate_cancel',
      expect.objectContaining({
        organization,
        project_id: project.id,
      })
    );
  });
});
