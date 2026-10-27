import {Fragment, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DroppedDataLLMContext} from 'sentry/components/droppedData/droppedDataLLMContext';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {LLMContextSnapshot} from 'sentry/views/seerExplorer/contexts/llmContextTypes';

const organization = OrganizationFixture({
  features: ['explore-data-fidelity-annotations'],
});

function WithDroppedDataLLMContext({children}: {children: ReactNode}) {
  return (
    <Fragment>
      <DroppedDataLLMContext dataset={DiscoverDatasets.SPANS} />
      {children}
    </Fragment>
  );
}

function findDroppedDataNode(snapshot: LLMContextSnapshot) {
  return snapshot.nodes.find(node => node.nodeType === 'dropped-data');
}

describe('DroppedDataLLMContext', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('registers nothing without the feature flag', () => {
    const {result} = renderHookWithProviders(() => useLLMContext(), {
      organization: OrganizationFixture({features: []}),
      additionalWrapper: WithDroppedDataLLMContext,
    });

    expect(findDroppedDataNode(result.current.getLLMContext())).toBeUndefined();
  });

  it('publishes the drops grouped by outcome once they load', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-dropped/`,
      body: {
        meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
        droppedEvents: [
          OutcomeRowFixture({outcome: 'rate_limited', count: 10}),
          OutcomeRowFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            count: 30,
          }),
        ],
        acceptedEvents: [
          OutcomeRowFixture({outcome: 'accepted', reason: 'accepted', count: 60}),
        ],
      },
    });

    const {result} = renderHookWithProviders(() => useLLMContext(), {
      organization,
      additionalWrapper: WithDroppedDataLLMContext,
    });

    await waitFor(() =>
      expect(findDroppedDataNode(result.current.getLLMContext())?.data).toEqual({
        contextHint: expect.any(String),
        dataset: DiscoverDatasets.SPANS,
        drops: [
          expect.objectContaining({outcome: 'client_discard', shareRatio: 0.3}),
          expect.objectContaining({outcome: 'rate_limited', shareRatio: 0.1}),
        ],
      })
    );
  });
});
