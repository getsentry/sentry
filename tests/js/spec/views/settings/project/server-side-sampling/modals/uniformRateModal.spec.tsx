import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {UniformRateModal} from 'sentry/views/settings/project/server-side-sampling/modals/uniformRateModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {getMockData} from '../utils';

describe('Server-side Sampling - Uniform Rate Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats_v2/',
      body: TestStubs.Outcomes(),
    });
  });

  it('render next button', async function () {
    const {organization, project} = getMockData();

    render(<GlobalModal />);

    openModal(modalProps => (
      <UniformRateModal
        {...modalProps}
        organization={organization}
        project={project}
        projectStats={TestStubs.Outcomes()}
        rules={[]}
        onSubmit={jest.fn()}
        onReadDocs={jest.fn()}
      />
    ));

    // Header
    expect(
      await screen.findByRole('heading', {
        name: 'Set a uniform sample rate for Transactions',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Similarly to how you would configure a/)
    ).toBeInTheDocument();

    // Content
    expect(screen.getByText('Last 30 days of Transactions')).toBeInTheDocument(); // Chart
    expect(screen.getByRole('radio', {name: 'Current'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Recommended'})).not.toBeChecked();
    expect(screen.getByText('100%')).toBeInTheDocument(); // Current client-side sample rate
    expect(screen.getByText('N/A')).toBeInTheDocument(); // Current server-side sample rate
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(30); // Recommended client-side sample rate
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(100); // Recommended server-side sample rate
    expect(
      screen.queryByLabelText('Reset to recommended values')
    ).not.toBeInTheDocument();

    // Enter custom client-side sample rate
    userEvent.clear(screen.getAllByRole('spinbutton')[0]);
    userEvent.type(screen.getAllByRole('spinbutton')[0], '20{enter}');
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(20); // Custom client-side sample rate
    expect(screen.getByRole('radio', {name: 'New'})).toBeChecked();
    expect(screen.getByLabelText('Reset to recommended values')).toBeInTheDocument();

    // Reset client-side sample rate to recommended value
    userEvent.click(screen.getByLabelText('Reset to recommended values'));
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(30); // Recommended client-side sample rate

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it.only('render done button', async function () {
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

    expect(await screen.findByRole('button', {name: 'Done'})).toBeDisabled();

    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(100); // Recommended client-side sample rate
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(100); // Recommended server-side sample rate
  });
});
