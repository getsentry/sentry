import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TagExportDropdown from 'sentry/views/issueDetails/groupDistributions/tagExportDropdown';

describe('TagExportDropdown', () => {
  const group = GroupFixture();
  const project = ProjectFixture();

  it('shows Export All option when organization has discover-query feature', async () => {
    const organization = OrganizationFixture({features: ['discover-query']});

    render(
      <TagExportDropdown
        tagKey="user"
        group={group}
        organization={organization}
        project={project}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export options'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Export Page to CSV'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Export All to CSV'})
    ).toBeInTheDocument();
  });

  it('disables Export All option when organization does not have discover-query feature', async () => {
    const organization = OrganizationFixture({features: []});

    render(
      <TagExportDropdown
        tagKey="user"
        group={group}
        organization={organization}
        project={project}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export options'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Export Page to CSV'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Export All to CSV'})
    ).toBeInTheDocument();
    const exportAllItem = screen.getByRole('menuitemradio', {name: 'Export All to CSV'});
    expect(exportAllItem).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(exportAllItem);
    expect(
      await screen.findByText('This feature is not available for your organization')
    ).toBeInTheDocument();
  });
});
