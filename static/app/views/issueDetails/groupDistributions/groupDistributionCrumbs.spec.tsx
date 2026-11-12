import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

import {GroupDistributionCrumbs} from './groupDistributionCrumbs';
import {DrawerTab} from './types';

describe('GroupDistributionCrumbs', () => {
  const group = GroupFixture();
  const project = ProjectFixture();

  function renderCrumbs({
    organization,
    tab = DrawerTab.TAGS,
    tagKey = 'user',
  }: {
    organization: Organization;
    tab?: DrawerTab;
    tagKey?: string;
  }) {
    return render(
      <GroupIdProvider groupId={group.id}>
        <GroupDistributionCrumbs group={group} project={project} tab={tab} />
      </GroupIdProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/${group.id}/distributions/${tagKey}/`,
          },
          route: '/organizations/:orgId/issues/:groupId/distributions/:tagKey/',
        },
      }
    );
  }

  it('shows Export All option when organization has discover-query feature', async () => {
    renderCrumbs({organization: OrganizationFixture({features: ['discover-query']})});

    expect(screen.getByText('user')).toHaveAttribute('aria-current', 'location');
    await userEvent.click(screen.getByRole('button', {name: 'Export options'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Export Page to CSV'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Export All to CSV'})
    ).toBeInTheDocument();
  });

  it('uses org-prefixed URL for page export', async () => {
    const organization = OrganizationFixture({features: ['discover-query']});
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    renderCrumbs({organization});

    await userEvent.click(screen.getByRole('button', {name: 'Export options'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Export Page to CSV'})
    );

    expect(openSpy).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/projects/${project.slug}/issues/${group.id}/tags/user/export/`,
      '_blank'
    );

    openSpy.mockRestore();
  });

  it('disables Export All option when organization does not have discover-query feature', async () => {
    renderCrumbs({organization: OrganizationFixture({features: []})});

    await userEvent.click(screen.getByRole('button', {name: 'Export options'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Export Page to CSV'})
    ).toBeInTheDocument();
    const exportAllItem = screen.getByRole('menuitemradio', {name: 'Export All to CSV'});
    expect(exportAllItem).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(exportAllItem);
    expect(
      await screen.findByText('This feature is not available for your organization')
    ).toBeInTheDocument();
  });

  it('renders the export after the current tag key', () => {
    renderCrumbs({organization: OrganizationFixture({features: ['discover-query']})});

    const navigation = screen.getByRole('navigation', {name: 'Breadcrumbs'});
    expect(navigation).toContainElement(screen.getByText('user'));
    expect(navigation).toContainElement(
      screen.getByRole('button', {name: 'Export options'})
    );
  });

  it('does not offer export for feature flags', () => {
    renderCrumbs({
      organization: OrganizationFixture({features: ['discover-query']}),
      tab: DrawerTab.FEATURE_FLAGS,
    });

    expect(screen.getByText('user')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Export options'})
    ).not.toBeInTheDocument();
  });
});
