import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectSecurityAndPrivacy, {
  ProjectSecurityAndPrivacyProps,
} from 'app/views/settings/projectSecurityAndPrivacy';

// @ts-ignore
const org = TestStubs.Organization();
// @ts-ignore
const project = TestStubs.ProjectDetails();
// @ts-ignore
const routerContext = TestStubs.routerContext([
  {
    // @ts-ignore
    router: TestStubs.router({
      params: {
        projectId: project.slug,
        orgId: org.slug,
      },
    }),
  },
]);

function renderComponent(props: Partial<ProjectSecurityAndPrivacyProps>) {
  const organization = props?.organization ?? org;
  // @ts-ignore
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/`,
    method: 'GET',
    body: project,
  });

  return mountWithTheme(
    <ProjectSecurityAndPrivacy
      project={project}
      {...routerContext}
      {...props}
      organization={organization}
    />
  );
}

describe('projectSecurityAndPrivacy', function() {
  it('renders form fields', function() {
    const wrapper = renderComponent({});

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

  it('disables field when equivalent org setting is true', function() {
    const newOrganization = {...org};
    newOrganization.dataScrubber = true;
    newOrganization.scrubIPAddresses = false;

    const wrapper = renderComponent({organization: newOrganization});

    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isDisabled')).toBe(
      false
    );

    expect(wrapper.find('Switch[name="scrubIPAddresses"]').prop('isActive')).toBeFalsy();
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isDisabled')).toBe(true);
    expect(wrapper.find('Switch[name="dataScrubber"]').prop('isActive')).toBe(true);
  });
});
