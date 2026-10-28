import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDatasetFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';

const organization = OrganizationFixture({features: ['explore-saved-formulas']});

function formulaLink(hasNextPage: boolean) {
  return (
    `<https://sentry.io/api/0/organizations/org-slug/explore/formulas/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ` +
    `<https://sentry.io/api/0/organizations/org-slug/explore/formulas/?cursor=0:100:0>; rel="next"; results="${hasNextPage}"; cursor="0:100:0"`
  );
}

const FORMULAS = [
  {
    id: '1',
    name: 'formula.apdex',
    dataset: 'spans',
    description: null,
    formula: 'count()',
    prebuilt: true,
    type: 'number',
    unit: null,
    references: [],
    params: [],
  },
  {
    id: '2',
    name: 'formula.log_rate',
    dataset: 'logs',
    description: null,
    formula: 'count()',
    prebuilt: false,
    type: 'number',
    unit: null,
    references: [],
    params: [],
  },
];

describe('useDatasetFormulas', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    errorLog = jest.spyOn(Sentry.logger, 'error');
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it('only returns formulas for the dataset', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/formulas/`,
      body: FORMULAS,
      headers: {Link: formulaLink(false)},
    });

    const {result} = renderHookWithProviders(() => useDatasetFormulas('logs'), {
      organization,
    });

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]!.name).toBe('formula.log_rate');
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('logs when there are more formulas than fit on one page', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/formulas/`,
      body: FORMULAS,
      headers: {Link: formulaLink(true)},
    });

    renderHookWithProviders(() => useDatasetFormulas('spans'), {organization});

    await waitFor(() =>
      expect(errorLog).toHaveBeenCalledWith(
        'Saved formulas exceeded the max page size',
        expect.objectContaining({dataset: 'spans', maxPerPage: 100})
      )
    );
  });
});
