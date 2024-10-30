import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Organization} from 'sentry/types/organization';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';

describe('SpansConfig', () => {
  let organization: Organization;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['performance-view'],
    });
  });

  it('returns all of the EAP aggregations as primary options', () => {
    const functionOptions = Object.keys(
      SpansConfig.getTableFieldOptions(organization, {})
    )
      .filter(func => func.startsWith('function'))
      .map(func => func.split(':')[1]);

    expect(functionOptions).toEqual(ALLOWED_EXPLORE_VISUALIZE_AGGREGATES);
  });
});
