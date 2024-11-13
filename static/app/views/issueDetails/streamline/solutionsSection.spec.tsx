import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useGroupSummary} from 'sentry/components/group/groupSummary';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import SolutionsSection from 'sentry/views/issueDetails/streamline/solutionsSection';

jest.mock('sentry/components/group/groupSummary');
jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/issueTypeConfig');

describe('SolutionsSection', () => {
  const mockEvent = EventFixture();
  const mockGroup = GroupFixture();
  const mockProject = ProjectFixture();
  const {organization} = initializeOrg({
    organization: OrganizationFixture(),
  });

  beforeEach(() => {
    (getConfigForIssueType as jest.Mock).mockReturnValue({
      issueSummary: {
        enabled: true,
      },
      resources: {
        description: 'Test Resource',
        links: [{link: 'https://example.com', text: 'Test Link'}],
        linksByPlatform: {},
      },
    });

    (useOrganization as jest.Mock).mockReturnValue({
      ...organization,
      hideAiFeatures: false,
      genAIConsent: true,
    });
  });

  const renderComponent = () =>
    render(
      <SolutionsSection event={mockEvent} group={mockGroup} project={mockProject} />,
      {
        organization,
      }
    );

  it('renders loading state when summary is pending', () => {
    (useGroupSummary as jest.Mock).mockReturnValue({
      isPending: true,
      data: null,
    });

    renderComponent();

    expect(screen.getByText('Solutions Hub')).toBeInTheDocument();
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders summary when AI features are enabled and data is available', () => {
    const mockSummary = 'This is a test summary';
    (useGroupSummary as jest.Mock).mockReturnValue({
      isPending: false,
      data: {
        whatsWrong: mockSummary,
      },
    });

    renderComponent();

    expect(screen.getByText(mockSummary)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Solutions Hub'})).toBeInTheDocument();
  });

  it('renders AI setup prompt when consent is not given', () => {
    (useGroupSummary as jest.Mock).mockReturnValue({
      isPending: false,
      data: null,
    });

    (useOrganization as jest.Mock).mockReturnValue({
      ...organization,
      hideAiFeatures: false,
      genAIConsent: false,
    });

    renderComponent();

    expect(
      screen.getByText('Explore potential root causes and solutions with Sentry AI.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Solutions Hub'})).toBeInTheDocument();
  });

  it('renders resources section when AI features are disabled', () => {
    (useGroupSummary as jest.Mock).mockReturnValue({
      isPending: false,
      data: null,
    });

    (useOrganization as jest.Mock).mockReturnValue({
      ...organization,
      hideAiFeatures: true,
      genAIConsent: false,
    });

    renderComponent();

    expect(screen.getByText('Test Link')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'READ MORE'})).toBeInTheDocument();
  });

  it('toggles resources content when clicking Read More/Show Less', async () => {
    (useGroupSummary as jest.Mock).mockReturnValue({
      isPending: false,
      data: null,
    });

    (useOrganization as jest.Mock).mockReturnValue({
      ...organization,
      hideAiFeatures: true,
      genAIConsent: false,
    });

    renderComponent();

    const readMoreButton = screen.getByRole('button', {name: 'READ MORE'});
    await userEvent.click(readMoreButton);

    expect(screen.getByRole('button', {name: 'SHOW LESS'})).toBeInTheDocument();

    const showLessButton = screen.getByRole('button', {name: 'SHOW LESS'});
    await userEvent.click(showLessButton);

    expect(screen.queryByRole('button', {name: 'SHOW LESS'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'READ MORE'})).toBeInTheDocument();
  });
});
