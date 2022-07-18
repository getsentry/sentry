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

  it('render with default values', async function () {
    const {organization, project} = getMockData();

    const handleSubmit = jest.fn();

    render(<GlobalModal />);

    openModal(modalProps => (
      <UniformRateModal
        {...modalProps}
        organization={organization}
        project={project}
        projectStats={TestStubs.Outcomes()}
        rules={[]}
        onSubmit={handleSubmit}
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
    expect(screen.getByText('Last 30 days of Transactions')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Current'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Recommended'})).not.toBeChecked();
    expect(screen.getByText('100%')).toBeInTheDocument(); // Current client-side sample rate
    expect(screen.getByText('N/A')).toBeInTheDocument(); // Current server-side sample rate
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(30); // Recommended client-side sample rate
    expect(screen.getAllByRole('spinbutton')[1]).toHaveValue(100); // Recommended server-side sample rate

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
  });
});
