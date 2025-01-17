import {MemberFixture} from 'sentry-fixture/member';
import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {useMembers} from 'sentry/utils/useMembers';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import MonitorForm from 'sentry/views/monitors/components/monitorForm';
import {ScheduleType} from 'sentry/views/monitors/types';

jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/useTeams');
jest.mock('sentry/utils/useMembers');

describe('MonitorForm', function () {
  const organization = OrganizationFixture();

  const member = MemberFixture({user: UserFixture({name: 'John Smith'})});
  const team = TeamFixture({slug: 'test-team'});
  const {project, router} = initializeOrg({organization});

  beforeEach(() => {
    jest.mocked(useProjects).mockReturnValue({
      fetchError: null,
      fetching: false,
      hasMore: false,
      initiallyLoaded: false,
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
      placeholders: [],
      projects: [project],
    });

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

  it('displays human readable schedule', async function () {
    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/monitors/`}
        onSubmitSuccess={jest.fn()}
      />,
      {router, organization}
    );

    const schedule = screen.getByRole('textbox', {name: 'Crontab Schedule'});

    await userEvent.clear(schedule);
    await userEvent.type(schedule, '5 * * * *');
    expect(screen.getByText('"At 5 minutes past the hour"')).toBeInTheDocument();
  });

  it('submits a new monitor', async function () {
    const mockHandleSubmitSuccess = jest.fn();

    const apiEndpont = `/organizations/${organization.slug}/monitors/`;

    render(
      <MonitorForm
        apiMethod="POST"
        apiEndpoint={apiEndpont}
        onSubmitSuccess={mockHandleSubmitSuccess}
        submitLabel="Add Monitor"
      />,
      {router, organization}
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

    await userEvent.click(screen.getByRole('button', {name: 'Add Monitor'}));

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

  it('prefills with an existing monitor', async function () {
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
      {router, organization}
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
});
