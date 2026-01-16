import {ActorFixture} from 'sentry-fixture/actor';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {UptimeAlertForm} from 'sentry/views/alerts/rules/uptime/uptimeAlertForm';

describe('Uptime Alert Form', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({environments: ['prod', 'dev']});

  beforeEach(() => {
    OrganizationStore.onUpdate(organization);
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture()],
    });
  });

  function input(name: string) {
    return screen.getByRole('textbox', {name});
  }

  function numberInput(name: string) {
    return screen.getByRole('spinbutton', {name});
  }

  it('can create a new rule', async () => {
    render(<UptimeAlertForm />, {organization});
    await screen.findByText('Configure Request');

    await selectEvent.select(input('Project'), project.slug);
    await selectEvent.select(input('Environment'), 'prod');

    const timeout = screen.getByRole('slider', {name: 'Timeout'});
    fireEvent.change(timeout, {target: {value: '10000'}});

    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com');

    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'POST');

    await userEvent.clear(input('Body'));
    await userEvent.type(input('Body'), '{{"key": "value"}');

    await userEvent.type(input('Name of header 1'), 'X-Something');
    await userEvent.type(input('Value of X-Something'), 'Header Value');

    await userEvent.click(screen.getByRole('checkbox', {name: 'Allow Sampling'}));

    // Test threshold fields - should be empty with placeholders
    expect(numberInput('Failure Tolerance')).toHaveValue(null);
    expect(numberInput('Recovery Tolerance')).toHaveValue(null);
    expect(numberInput('Failure Tolerance')).toHaveAttribute(
      'placeholder',
      'Defaults to 3'
    );
    expect(numberInput('Recovery Tolerance')).toHaveAttribute(
      'placeholder',
      'Defaults to 1'
    );

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'New Uptime Rule');

    await selectEvent.select(input('Owner'), 'Foo Bar');

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/`,
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environment: 'prod',
          name: 'New Uptime Rule',
          owner: 'user:1',
          url: 'http://example.com',
          method: 'POST',
          headers: [['X-Something', 'Header Value']],
          body: '{"key": "value"}',
          traceSampling: true,
          intervalSeconds: 60,
          timeoutMs: 10_000,
        }),
      })
    );
  });

  it('can create a new rule with custom thresholds', async () => {
    render(<UptimeAlertForm />, {organization});
    await screen.findByText('Configure Request');

    await selectEvent.select(input('Project'), project.slug);
    await selectEvent.select(input('Environment'), 'prod');
    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com');

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Rule with Custom Thresholds');

    // Set custom threshold values
    await userEvent.type(numberInput('Failure Tolerance'), '5');
    await userEvent.type(numberInput('Recovery Tolerance'), '2');

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/`,
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environment: 'prod',
          name: 'Rule with Custom Thresholds',
          url: 'http://example.com',
          downtimeThreshold: '5',
          recoveryThreshold: '2',
        }),
      })
    );
  });

  it('renders existing rule', async () => {
    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      environment: 'prod',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      method: 'POST',
      headers: [
        ['X-Test1', 'value 1'],
        ['X-Test2', 'value 2'],
      ],
      body: '{"key": "value"}',
      traceSampling: true,
      timeoutMs: 7500,
      owner: ActorFixture(),
      downtimeThreshold: 4,
      recoveryThreshold: 2,
    });
    render(<UptimeAlertForm rule={rule} />, {organization});
    await screen.findByText('Configure Request');

    expect(input('Uptime rule name')).toHaveValue('Existing Rule');
    expect(input('URL')).toHaveValue('https://existing-url.com');
    expect(input('Body')).toHaveValue('{"key": "value"}');
    expect(input('Name of header 1')).toHaveValue('X-Test1');
    expect(input('Name of header 2')).toHaveValue('X-Test2');
    expect(input('Value of X-Test1')).toHaveValue('value 1');
    expect(input('Value of X-Test2')).toHaveValue('value 2');
    await selectEvent.openMenu(input('Method'));
    expect(screen.getByRole('menuitemradio', {name: 'POST'})).toBeChecked();
    await selectEvent.openMenu(input('Environment'));
    expect(screen.getByRole('menuitemradio', {name: 'prod'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Allow Sampling'})).toBeChecked();
    expect(screen.getByRole('slider', {name: 'Timeout'})).toHaveValue('7500');
    expect(numberInput('Failure Tolerance')).toHaveValue(4);
    expect(numberInput('Recovery Tolerance')).toHaveValue(2);
  });

  it('handles simple edits', async () => {
    // XXX(epurkhiser): This test covers the case where the formModel waws not
    // triggering the observer that updates the apiEndpoint url based on the
    // selected project for existing rules. The other tests all pass as the
    // triggered error state from clearing the fields causes the observer to be
    // called for the first time and correctly set the apiEndpoint.

    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      owner: ActorFixture(),
    });
    render(<UptimeAlertForm rule={rule} />, {organization});
    await screen.findByText('Configure Request');

    await userEvent.type(input('URL'), '/test');

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${rule.id}/`,
      method: 'PUT',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          url: 'https://existing-url.com/test',
        }),
      })
    );
  });

  it('can edit an existing rule', async () => {
    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      owner: ActorFixture(),
      traceSampling: false,
      downtimeThreshold: 4,
      recoveryThreshold: 2,
    });
    render(<UptimeAlertForm rule={rule} />, {organization});
    await screen.findByText('Configure Request');

    await selectEvent.select(input('Interval'), 'Every 10 minutes');
    await selectEvent.select(input('Environment'), 'dev');

    const timeout = screen.getByRole('slider', {name: 'Timeout'});
    fireEvent.change(timeout, {target: {value: '7500'}});

    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://another-url.com');

    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'POST');

    await userEvent.clear(input('Body'));
    await userEvent.type(input('Body'), '{{"different": "value"}');

    await userEvent.type(input('Name of header 1'), 'X-Something');
    await userEvent.type(input('Value of X-Something'), 'Header Value');
    await userEvent.click(screen.getByRole('button', {name: 'Add Header'}));
    await userEvent.type(input('Name of header 2'), 'X-Another');
    await userEvent.type(input('Value of X-Another'), 'Second Value');

    await userEvent.click(screen.getByRole('checkbox', {name: 'Allow Sampling'}));

    // Update threshold values
    await userEvent.clear(numberInput('Failure Tolerance'));
    await userEvent.type(numberInput('Failure Tolerance'), '6');
    await userEvent.clear(numberInput('Recovery Tolerance'));
    await userEvent.type(numberInput('Recovery Tolerance'), '3');

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Updated name');

    await selectEvent.select(input('Owner'), 'Foo Bar');

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${rule.id}/`,
      method: 'PUT',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Updated name',
          environment: 'dev',
          owner: 'user:1',
          url: 'http://another-url.com',
          method: 'POST',
          headers: [
            ['X-Something', 'Header Value'],
            ['X-Another', 'Second Value'],
          ],
          body: '{"different": "value"}',
          intervalSeconds: 60 * 10,
          traceSampling: true,
          timeoutMs: 7500,
          downtimeThreshold: '6',
          recoveryThreshold: '3',
        }),
      })
    );
  }, 20_000);

  it('does not show body for GET and HEAD', async () => {
    const rule = UptimeRuleFixture({
      projectSlug: project.slug,
      owner: ActorFixture(),
    });
    render(<UptimeAlertForm rule={rule} />, {organization});
    await screen.findByText('Configure Request');

    // GET
    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'GET');
    expect(screen.queryByRole('textbox', {name: 'Body'})).not.toBeInTheDocument();

    // HEAD
    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'HEAD');
    expect(screen.queryByRole('textbox', {name: 'Body'})).not.toBeInTheDocument();

    // POST
    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'POST');
    expect(input('Body')).toBeInTheDocument();
  });

  it('updates environments for different projects', async () => {
    const project1 = ProjectFixture({
      slug: 'project-1',
      environments: ['dev-1', 'prod-1'],
    });
    const project2 = ProjectFixture({
      slug: 'project-2',
      environments: ['dev-2', 'prod-2'],
    });

    ProjectsStore.loadInitialData([project, project1, project2]);
    render(<UptimeAlertForm />, {organization});
    await screen.findByText('Configure Request');

    // Select project 1
    await selectEvent.openMenu(input('Project'));
    expect(screen.getByRole('menuitemradio', {name: 'project-1'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'project-2'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'project-1'}));

    // Verify correct envs
    await selectEvent.openMenu(input('Environment'));
    expect(screen.getByRole('menuitemradio', {name: 'dev-1'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'prod-1'})).toBeInTheDocument();

    // Select project 2
    await selectEvent.openMenu(input('Project'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'project-2'}));

    // Verify correct envs
    await selectEvent.openMenu(input('Environment'));
    expect(screen.getByRole('menuitemradio', {name: 'dev-2'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'prod-2'})).toBeInTheDocument();
  });

  it('can create a new environment', async () => {
    render(<UptimeAlertForm />, {organization});
    await screen.findByText('Configure Request');

    await selectEvent.select(input('Project'), project.slug);
    await userEvent.type(input('Environment'), 'my-custom-env');
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Create "my-custom-env"'})
    );

    await selectEvent.select(input('Interval'), 'Every 10 minutes');

    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com');

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'New Uptime Rule');

    const createMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/`,
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Rule'}));

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({}),
      })
    );
  });

  it('sets a default name from the url', async () => {
    render(<UptimeAlertForm />, {organization});
    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://my-cool-site.com/');

    const simpleName = input('Uptime rule name');
    expect(simpleName).toHaveValue('Uptime check for my-cool-site.com');

    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com/with-path');

    const pathName = input('Uptime rule name');
    expect(pathName).toHaveValue('Uptime check for example.com/with-path');
  });

  it('sends assertion in create request when feature is enabled', async () => {
    const orgWithAssertions = OrganizationFixture({
      features: ['uptime-runtime-assertions'],
    });
    OrganizationStore.onUpdate(orgWithAssertions);

    render(<UptimeAlertForm />, {organization: orgWithAssertions});
    await screen.findByText('Configure Request');

    // Verify the Verification section is shown
    expect(screen.getByText('Verification')).toBeInTheDocument();

    await selectEvent.select(input('Project'), project.slug);
    await selectEvent.select(input('Environment'), 'prod');
    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com');

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Rule with Assertion');

    const createMock = MockApiClient.addMockResponse({
      url: `/projects/${orgWithAssertions.slug}/${project.slug}/uptime/`,
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Rule'}));

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Rule with Assertion',
          url: 'http://example.com',
          assertion: {root: {op: 'and', children: [], id: expect.any(String)}},
        }),
      })
    );
  });

  it('does not show assertions when feature is disabled', async () => {
    const orgWithoutAssertions = OrganizationFixture({
      features: [],
    });
    OrganizationStore.onUpdate(orgWithoutAssertions);

    render(<UptimeAlertForm />, {organization: orgWithoutAssertions});
    await screen.findByText('Configure Request');

    // Verify the Verification section is NOT shown
    expect(screen.queryByText('Verification')).not.toBeInTheDocument();
  });

  it('renders and updates assertion for existing rule', async () => {
    const orgWithAssertions = OrganizationFixture({
      features: ['uptime-runtime-assertions'],
    });
    OrganizationStore.onUpdate(orgWithAssertions);

    const assertion = {
      root: {
        op: 'and' as const,
        children: [
          {
            id: 'test-1',
            op: 'status_code_check' as const,
            operator: {cmp: 'equals' as const},
            value: 200,
          },
        ],
        id: 'root-1',
      },
    };

    const rule = UptimeRuleFixture({
      name: 'Rule with Assertion',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      owner: ActorFixture(),
      assertion,
    });

    render(<UptimeAlertForm rule={rule} />, {organization: orgWithAssertions});
    await screen.findByText('Verification');

    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${orgWithAssertions.slug}/${project.slug}/uptime/${rule.id}/`,
      method: 'PUT',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          assertion,
        }),
      })
    );
  });
});
