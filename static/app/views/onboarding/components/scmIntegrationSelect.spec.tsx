import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScmIntegrationSelect} from './scmIntegrationSelect';

const githubGetsentry = OrganizationIntegrationsFixture({
  id: '1',
  name: 'getsentry',
  domainName: 'github.com/getsentry',
  provider: {
    key: 'github',
    slug: 'github',
    name: 'GitHub',
    canAdd: true,
    canDisable: false,
    features: ['commits'],
    aspects: {},
  },
});

const gitlabAcme = OrganizationIntegrationsFixture({
  id: '2',
  name: 'acme',
  domainName: 'gitlab.com/acme',
  provider: {
    key: 'gitlab',
    slug: 'gitlab',
    name: 'GitLab',
    canAdd: true,
    canDisable: false,
    features: ['commits'],
    aspects: {},
  },
});

describe('ScmIntegrationSelect', () => {
  const organization = OrganizationFixture();

  it('renders the selected integration name in the trigger', async () => {
    render(
      <ScmIntegrationSelect
        integrations={[githubGetsentry, gitlabAcme]}
        selectedIntegration={githubGetsentry}
        onChange={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByRole('button', {name: /getsentry/})).toBeInTheDocument();
  });

  it('lists every active integration and calls onChange on selection', async () => {
    const onChange = jest.fn();
    render(
      <ScmIntegrationSelect
        integrations={[githubGetsentry, gitlabAcme]}
        selectedIntegration={githubGetsentry}
        onChange={onChange}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: /getsentry/}));

    expect(screen.getByRole('option', {name: 'getsentry'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'acme'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: 'acme'}));

    expect(onChange).toHaveBeenCalledWith(gitlabAcme);
  });

  it('links the Manage providers footer to SCM integration settings', async () => {
    render(
      <ScmIntegrationSelect
        integrations={[githubGetsentry]}
        selectedIntegration={githubGetsentry}
        onChange={jest.fn()}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: /getsentry/}));

    expect(await screen.findByRole('button', {name: 'Manage providers'})).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/?category=source%20code%20management'
    );
  });
});
