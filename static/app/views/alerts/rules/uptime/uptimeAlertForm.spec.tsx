import {ActorFixture} from 'sentry-fixture/actor';
import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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

  it('renders existing rule', async function () {
    const {organization, project} = initializeOrg();
    OrganizationStore.onUpdate(organization);

    const rule = UptimeRuleFixture({
      name: 'Existing Rule',
      url: 'https://existing-url.com',
      projectSlug: project.slug,
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

    expect(await screen.findByRole('textbox', {name: 'Uptime rule name'})).toHaveValue(
      'Existing Rule'
    );
    expect(await screen.findByRole('textbox', {name: 'URL'})).toHaveValue(
      'https://existing-url.com'
    );
  });
});
