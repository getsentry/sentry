import {OrganizationFixture} from 'sentry-fixture/organization';

import {getOrgRoles} from 'getsentry/hooks/organizationRoles';

describe('OrganizationRoles', function () {
  it('includes admin if org does not have team-roles', function () {
    const organization = OrganizationFixture({features: []});
    const result = getOrgRoles(organization);
    expect(result).toHaveLength(5);
    expect(result[2]?.id).toBe('admin');
  });

  it('does not include admin if org has team-roles', function () {
    const organization = OrganizationFixture({features: ['team-roles']});
    const result = getOrgRoles(organization);
    expect(result).toHaveLength(4);
  });
});
