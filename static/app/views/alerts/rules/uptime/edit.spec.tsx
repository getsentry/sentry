import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import OrganizationStore from 'sentry/stores/organizationStore';

import {UptimeRulesEdit} from './edit';

describe('uptime/edit', function () {
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

  it('displays the edit form', async function () {
    const {organization, project, routerProps} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const uptimeRule = UptimeRuleFixture();

    const handleChangeTitle = jest.fn();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRule.id}/`,
      method: 'GET',
      body: uptimeRule,
    });

    render(
      <UptimeRulesEdit
        {...routerProps}
        onChangeTitle={handleChangeTitle}
        userTeamIds={[]}
        organization={organization}
        project={project}
        params={{projectId: project.slug, ruleId: uptimeRule.id}}
      />,
      {organization}
    );
    await screen.findByText('Configure Request');

    const url = screen.getByRole('textbox', {name: 'URL'});
    expect(url).toHaveValue(uptimeRule.url);

    const name = screen.getByRole('textbox', {name: 'Uptime rule name'});
    expect(name).toHaveValue(uptimeRule.name);

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Owner'}));
    expect(screen.getByRole('menuitemradio', {name: 'Foo Bar'})).toBeChecked();
  });

  it('can delete rule', async function () {
    const {organization, project, routerProps} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const uptimeRule = UptimeRuleFixture();

    const handleChangeTitle = jest.fn();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRule.id}/`,
      method: 'GET',
      body: uptimeRule,
    });

    render(
      <UptimeRulesEdit
        {...routerProps}
        onChangeTitle={handleChangeTitle}
        userTeamIds={[]}
        organization={organization}
        project={project}
        params={{projectId: project.slug, ruleId: uptimeRule.id}}
      />,
      {organization}
    );
    await screen.findByText('Configure Request');

    const deleteRule = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeRule.id}/`,
      method: 'DELETE',
    });

    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Delete Rule'}));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', {name: 'Delete Rule'}));
    expect(deleteRule).toHaveBeenCalled();
  });
});
