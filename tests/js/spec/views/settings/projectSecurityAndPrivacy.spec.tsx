import {mountWithTheme} from 'sentry-test/enzyme';

import {Organization} from 'sentry/types';
import ProjectSecurityAndPrivacy from 'sentry/views/settings/projectSecurityAndPrivacy';

const org = TestStubs.Organization();
const project = TestStubs.ProjectDetails();

function renderComponent(providedOrg?: Organization) {
  const organization = providedOrg ?? org;

  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/`,
    method: 'GET',
    body: project,
  });

  return mountWithTheme(
    <ProjectSecurityAndPrivacy
      {...TestStubs.routerContext().context}
      project={project}
      organization={organization}
      params={{orgId: organization.slug, projectId: project.slug}}
    />
  );
}

describe('projectSecurityAndPrivacy', function () {
  it('renders form fields', function () {
    const wrapper = renderComponent();

    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isActive')).toBeFalsy();
    expect(
      wrapper.find('Switch[name="dataScrubberDefaults"]').prop('isActive')
    ).toBeFalsy();
    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isActive')).toBeFalsy();
    expect(wrapper.find('TextArea[name="sensitiveFields"]').prop('value')).toBe(
      'creditcard\nssn'
    );
    expect(wrapper.find('TextArea[name="safeFields"]').prop('value')).toBe(
      'business-email\ncompany'
    );
  });

  it('disables field when equivalent org setting is true', function () {
    const newOrganization = {...org};
    newOrganization.dataScrubber = true;
    newOrganization.scrubIPAddresses = false;

    const wrapper = renderComponent(newOrganization);

    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isDisabled')).toBe(
      false
    );

    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isActive')).toBeFalsy();
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isDisabled')).toBe(true);
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isActive')).toBe(true);
  });
});
