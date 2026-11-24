import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {getAddInboundFilterAvailability} from './addInboundFilterAvailability';

describe('getAddInboundFilterAvailability', () => {
  const flags = [
    'inbound-filters-v2',
    'inbound-filters-v2-ui',
    'inbound-filters-in-product-flows',
  ];
  const organization = OrganizationFixture({features: flags, access: ['project:write']});
  const project = ProjectFixture({features: ['custom-inbound-filters']});

  it('is visible and enabled with the flags, the plan feature and write access', () => {
    expect(getAddInboundFilterAvailability(organization, project)).toEqual({
      isVisible: true,
      disabledReason: undefined,
    });
  });

  it.each(flags)('is hidden without %s', flag => {
    const org = OrganizationFixture({
      ...organization,
      features: flags.filter(f => f !== flag),
    });

    expect(getAddInboundFilterAvailability(org, project).isVisible).toBe(false);
  });

  it('is disabled when the plan lacks custom inbound filters', () => {
    expect(
      getAddInboundFilterAvailability(organization, ProjectFixture({features: []}))
        .disabledReason
    ).toBe('Your plan does not include custom inbound filters');
  });

  it('is disabled without project write access', () => {
    const org = OrganizationFixture({...organization, access: []});

    expect(
      getAddInboundFilterAvailability(org, ProjectFixture({...project, access: []}))
        .disabledReason
    ).toBe('You need project write access to add custom inbound filters');
  });

  it('accepts write access granted on the project alone', () => {
    const org = OrganizationFixture({...organization, access: []});

    expect(
      getAddInboundFilterAvailability(
        org,
        ProjectFixture({...project, access: ['project:write']})
      ).disabledReason
    ).toBeUndefined();
  });
});
