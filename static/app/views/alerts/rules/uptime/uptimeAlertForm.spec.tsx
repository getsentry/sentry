import {ActorFixture} from 'sentry-fixture/actor';
import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import OrganizationStore from 'sentry/stores/organizationStore';
import {UptimeAlertForm} from 'sentry/views/alerts/rules/uptime/uptimeAlertForm';

describe('Uptime Alert Form', function () {
  beforeEach(function () {
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

  it('can create a new rule', async function () {
    const {organization, project} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    render(
      <UptimeAlertForm
        apiMethod="POST"
        apiUrl={'/update-rule'}
        project={project}
        onSubmitSuccess={() => {}}
      />,
      {organization}
    );
    await screen.findByText('Configure Request');

    await userEvent.clear(input('URL'));
    await userEvent.type(input('URL'), 'http://example.com');

    await selectEvent.clearAll(input('Method'));
    await selectEvent.select(input('Method'), 'POST');

    await userEvent.clear(input('Body'));
    await userEvent.type(input('Body'), '{{"key": "value"}');

    await userEvent.type(input('Name of header 1'), 'X-Something');
    await userEvent.type(input('Value of X-Something'), 'Header Value');

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'New Uptime Rule');

    await selectEvent.select(screen.getByRole('textbox', {name: 'Owner'}), 'Foo Bar');

    const updateMock = MockApiClient.addMockResponse({
      url: '/update-rule',
      method: 'POST',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Uptime Rule',
          owner: 'user:1',
          url: 'http://example.com',
          method: 'POST',
          headers: [['X-Something', 'Header Value']],
          body: '{"key": "value"}',
          intervalSeconds: 60,
        }),
      })
    );
  });

  it('renders existing rule', async function () {
    const {organization, project} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      method: 'POST',
      headers: [
        ['X-Test1', 'value 1'],
        ['X-Test2', 'value 2'],
      ],
      body: '{"key": "value"}',
      owner: ActorFixture(),
    });
    render(
      <UptimeAlertForm
        apiMethod="PUT"
        apiUrl={''}
        project={project}
        onSubmitSuccess={() => {}}
        rule={rule}
      />,
      {organization}
    );
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
  });

  it('can edit an existing rule', async function () {
    const {organization, project} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      projectSlug: project.slug,
      url: 'https://existing-url.com',
      owner: ActorFixture(),
    });
    render(
      <UptimeAlertForm
        apiMethod="PUT"
        apiUrl={'/update-rule'}
        project={project}
        onSubmitSuccess={() => {}}
        rule={rule}
      />,
      {organization}
    );
    await screen.findByText('Configure Request');

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

    const name = input('Uptime rule name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Updated name');

    await selectEvent.select(screen.getByRole('textbox', {name: 'Owner'}), 'Foo Bar');

    const updateMock = MockApiClient.addMockResponse({
      url: '/update-rule',
      method: 'PUT',
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Rule'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Updated name',
          owner: 'user:1',
          url: 'http://another-url.com',
          method: 'POST',
          headers: [
            ['X-Something', 'Header Value'],
            ['X-Another', 'Second Value'],
          ],
          body: '{"different": "value"}',
          intervalSeconds: 60,
        }),
      })
    );
  });

  it('does not show body for GET and HEAD', async function () {
    const {organization, project} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const rule = UptimeRuleFixture({
      projectSlug: project.slug,
      owner: ActorFixture(),
    });
    render(
      <UptimeAlertForm
        apiMethod="PUT"
        apiUrl={'/update-rule'}
        project={project}
        onSubmitSuccess={() => {}}
        rule={rule}
      />,
      {organization}
    );
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
    expect(screen.getByRole('textbox', {name: 'Body'})).toBeInTheDocument();
  });
});
