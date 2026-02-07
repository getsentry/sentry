import {MemberFixture} from 'sentry-fixture/member';
import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';
import MonitorForm from 'sentry/views/insights/crons/components/monitorForm';
import {ScheduleType} from 'sentry/views/insights/crons/types';

jest.mock('sentry/utils/useTeams');
jest.mock('sentry/utils/useMembers');

describe('MonitorForm', () => {
  const organization = OrganizationFixture();

  const member = MemberFixture({user: UserFixture({name: 'John Smith'})});
  const team = TeamFixture({slug: 'test-team'});
  const {project} = initializeOrg({organization});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);

    jest.mocked(useTeams).mockReturnValue({
      fetchError: null,
      fetching: false,
      hasMore: false,
      initiallyLoaded: false,
      loadMore: jest.fn(),
      onSearch: jest.fn(),
      teams: [team],
    });

    jest.mocked(useMembers).mockReturnValue({
      fetchError: null,
      fetching: false,
      hasMore: false,
      initiallyLoaded: false,
      loadMore: jest.fn(),
      onSearch: jest.fn(),
      members: [member.user!],
    });
  });

  it('shows validation errors on required sibling fields after first field change', async () => {
    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/monitors/`}
        onSubmitSuccess={jest.fn()}
      />,
      {organization}
    );

    // Initially no validation error tooltips should be rendered
    expect(document.querySelectorAll('[data-tooltip]')).toHaveLength(0);

    // Change one field (schedule) to trigger first-change validation
    const schedule = screen.getByRole('textbox', {name: 'Crontab Schedule'});
    await userEvent.clear(schedule);
    await userEvent.type(schedule, '5 * * * *');

    // Validation error tooltips should now appear on other required empty fields
    await waitFor(() => {
      expect(document.querySelectorAll('[data-tooltip]').length).toBeGreaterThan(0);
    });
  });

  it('displays human readable schedule', async () => {
    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/monitors/`}
        onSubmitSuccess={jest.fn()}
      />,
      {
        organization,
      }
    );

    const schedule = screen.getByRole('textbox', {name: 'Crontab Schedule'});

    await userEvent.clear(schedule);
    await userEvent.type(schedule, '5 * * * *');
    expect(screen.getByText('"At 5 minutes past the hour"')).toBeInTheDocument();
  });

  it('submits a new monitor', async () => {
    const mockHandleSubmitSuccess = jest.fn();

    const apiEndpont = `/organizations/${organization.slug}/monitors/`;

    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={apiEndpont}
        onSubmitSuccess={mockHandleSubmitSuccess}
        submitLabel="Add Cron Monitor"
      />,
      {
        organization,
      }
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'My Monitor');

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Project'}),
      project.slug
    );

    const schedule = screen.getByRole('textbox', {name: 'Crontab Schedule'});
    await userEvent.clear(schedule);
    await userEvent.type(schedule, '5 * * * *');

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Timezone'}),
      'Los Angeles'
    );

    await userEvent.type(screen.getByRole('spinbutton', {name: 'Grace Period'}), '5');
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Max Runtime'}), '20');

    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Failure Tolerance'}),
      '4'
    );
    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Recovery Tolerance'}),
      '2'
    );

    const ownerSelect = screen.getByRole('textbox', {name: 'Owner'});
    await selectEvent.select(ownerSelect, 'John Smith');

    const notifySelect = screen.getByRole('textbox', {name: 'Notify'});

    await selectEvent.openMenu(notifySelect);
    expect(
      screen.getByRole('menuitemcheckbox', {name: 'John Smith'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemcheckbox', {name: '#test-team'})
    ).toBeInTheDocument();

    await selectEvent.select(notifySelect, 'John Smith');

    const submitMock = MockApiClient.addMockResponse({
      url: apiEndpont,
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add Cron Monitor'}));

    const config = {
      checkinMargin: '5',
      maxRuntime: '20',
      failureIssueThreshold: '4',
      recoveryThreshold: '2',
      schedule: '5 * * * *',
      scheduleType: 'crontab',
      timezone: 'America/Los_Angeles',
    };

    const alertRule = {
      environment: undefined,
      targets: [{targetIdentifier: 1, targetType: 'Member'}],
    };

    expect(submitMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'My Monitor',
          project: 'project-slug',
          owner: `user:${member.user?.id}`,
          config,
          alertRule,
        },
      })
    );

    expect(mockHandleSubmitSuccess).toHaveBeenCalled();
  });

  it('prefills with an existing monitor', async () => {
    const monitor = MonitorFixture({project});

    const apiEndpont = `/projects/${organization.slug}/${monitor.project.slug}/monitors/${monitor.slug}/`;

    if (monitor.config.schedule_type !== ScheduleType.CRONTAB) {
      throw new Error('Fixture is not crontab');
    }

    render(
      <MonitorForm
        monitor={monitor}
        apiMethod="POST"
        apiEndpoint={apiEndpont}
        onSubmitSuccess={jest.fn()}
        submitLabel="Edit Monitor"
      />,
      {
        organization,
      }
    );

    // Name and slug
    expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue(monitor.name);
    expect(screen.getByRole('textbox', {name: 'Slug'})).toHaveValue(monitor.slug);

    // Project
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeDisabled();
    expect(screen.getByText(project.slug)).toBeInTheDocument();

    // Schedule type
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Schedule Type'}));
    const crontabOption = screen.getByRole('menuitemradio', {name: 'Crontab'});
    expect(crontabOption).toBeChecked();
    await userEvent.click(crontabOption);

    // Schedule value
    expect(screen.getByRole('textbox', {name: 'Crontab Schedule'})).toHaveValue(
      monitor.config.schedule
    );

    // Schedule timezone
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Timezone'}));
    const losAngelesOption = screen.getByRole('menuitemradio', {name: 'Los Angeles'});
    expect(losAngelesOption).toBeChecked();
    await userEvent.click(losAngelesOption);

    // Margins
    expect(screen.getByRole('spinbutton', {name: 'Grace Period'})).toHaveValue(5);
    expect(screen.getByRole('spinbutton', {name: 'Max Runtime'})).toHaveValue(10);

    // Tolerances
    expect(screen.getByRole('spinbutton', {name: 'Failure Tolerance'})).toHaveValue(2);
    expect(screen.getByRole('spinbutton', {name: 'Recovery Tolerance'})).toHaveValue(2);

    // Ownership
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Owner'}));
    const ownerOption = screen.getByRole('menuitemradio', {name: member.user?.name});
    expect(ownerOption).toBeChecked();
    await userEvent.keyboard('{Escape}');

    // Alert rule configuration
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Notify'}));
    const memberOption = screen.getByRole('menuitemcheckbox', {name: member.user?.name});
    expect(memberOption).toBeChecked();
    await userEvent.keyboard('{Escape}');

    const submitMock = MockApiClient.addMockResponse({
      url: apiEndpont,
      method: 'POST',
    });

    // Monitor form is not submitable until something is changed
    const submitButton = screen.getByRole('button', {name: 'Edit Monitor'});
    expect(submitButton).toBeDisabled();

    // Change Failure Tolerance
    await userEvent.clear(screen.getByRole('spinbutton', {name: 'Failure Tolerance'}));
    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Failure Tolerance'}),
      '10'
    );

    await userEvent.click(submitButton);

    // XXX(epurkhiser): When the values are loaded directly from the
    // monitor they come in as numbers, when changed via the toggles they
    // are translated to strings :(
    const config = {
      maxRuntime: monitor.config.max_runtime,
      checkinMargin: monitor.config.checkin_margin,
      recoveryThreshold: monitor.config.recovery_threshold,
      schedule: monitor.config.schedule,
      scheduleType: monitor.config.schedule_type,
      timezone: monitor.config.timezone,
      failureIssueThreshold: '10',
    };

    const alertRule = {
      environment: undefined,
      targets: [{targetIdentifier: 1, targetType: 'Member'}],
    };

    expect(submitMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: monitor.name,
          slug: monitor.slug,
          project: monitor.project.slug,
          owner: `user:${member.user?.id}`,
          config,
          alertRule,
        },
      })
    );
  });

  it('filters non-ASCII characters from crontab schedule', async () => {
    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/monitors/`}
        onSubmitSuccess={jest.fn()}
      />,
      {organization}
    );

    const schedule = screen.getByRole('textbox', {name: 'Crontab Schedule'});

    // Type schedule with emoji and Unicode characters
    await userEvent.clear(schedule);
    await userEvent.type(schedule, '5 * * * *😀中文');

    // Non-ASCII characters should be filtered out, leaving only valid ASCII
    expect(schedule).toHaveValue('5 * * * *');
  });
});
