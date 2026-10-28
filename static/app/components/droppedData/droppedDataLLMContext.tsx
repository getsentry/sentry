import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/outcomeSections';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

const CONTEXT_HINT =
  'Sentry dropped-data panel. drops are the events Sentry dropped for this ' +
  'dataset over the current date range, grouped by outcome then reason, each ' +
  'with its event count and share of total (accepted + dropped) events. ' +
  'A drop can be intentional or unintentional.';

interface DroppedDataLLMContextProps {
  dataset: DiscoverDatasets;
}

function DroppedDataLLMContextInner({dataset}: DroppedDataLLMContextProps) {
  const [interval] = useChartInterval();
  const {droppedEvents, acceptedEvents, isPending} = useDroppedData({dataset, interval});
  useLLMContext(
    {
      contextHint: CONTEXT_HINT,
      dataset,
      drops: droppedEventsToOutcomeSections(droppedEvents ?? [], acceptedEvents ?? []),
    },
    {isLoading: isPending}
  );
  return null;
}

/**
 * Publish the dropped-data table as its own Seer page-context node, nested under
 * the explorer page node. Mounted once per page (not per chart) so the drops are
 * registered a single time, and on a persistent component so they survive the
 * Dropped Data drawer being replaced by the Seer Explorer drawer. A dedicated
 * registered node — rather than a bare `useLLMContext` — keeps the drops from
 * overwriting the explorer page node's own search/filter/date-range data, since
 * `updateNodeData` replaces (not merges) a node's data.
 */
const RegisteredDroppedDataLLMContext = registerLLMContext(
  'dropped-data',
  DroppedDataLLMContextInner
);

export function DroppedDataLLMContext(props: DroppedDataLLMContextProps) {
  const organization = useOrganization();
  if (!organization.features.includes('explore-data-fidelity-annotations')) {
    return null;
  }
  return <RegisteredDroppedDataLLMContext {...props} />;
}
