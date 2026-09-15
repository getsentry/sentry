import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AppIcon} from 'sentry/views/preprod/components/appIcon';

describe('AppIcon', () => {
  it('explicitly requests a preprod size app icon', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture();

    render(
      <AppIcon appName="Example App" appIconId="opaque-icon-id" projectId={project.id} />,
      {organization}
    );

    expect(screen.getByRole('img', {name: 'App Icon'})).toHaveAttribute(
      'src',
      `/api/0/projects/${organization.slug}/${project.id}/files/images/opaque-icon-id/?image_type=preprod_size_app_icon`
    );
  });
});
