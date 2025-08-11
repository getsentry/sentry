import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TagExportDropdown from 'sentry/views/issueDetails/groupDistributions/tagExportDropdown';

describe('TagExportDropdown', function () {
  const group = GroupFixture();
  const project = ProjectFixture();
  const orgWithFeature = OrganizationFixture({features: ['discover-query']});
  const orgWithoutFeature = OrganizationFixture({features: []});

  it('does not render when org lacks discover-query feature', function () {
    render(
      <TagExportDropdown
        organization={orgWithoutFeature}
        project={project}
        group={group}
        tagKey="user"
      />,
      {organization: orgWithoutFeature}
    );

    expect(screen.queryByLabelText('Export options')).not.toBeInTheDocument();
  });

  it('renders when org has discover-query feature', function () {
    render(
      <TagExportDropdown
        organization={orgWithFeature}
        project={project}
        group={group}
        tagKey="user"
      />,
      {organization: orgWithFeature}
    );

    expect(screen.getByLabelText('Export options')).toBeInTheDocument();
  });
});
