import {unreachable} from 'sentry/utils/unreachable';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

/**
 * Convert backend dataset to our form dataset
 */
export const getDetectorDataset = (
  backendDataset: Dataset,
  eventTypes: EventTypes[]
): DetectorDataset => {
  switch (backendDataset) {
    case Dataset.REPLAYS: {
      throw new Error('Unsupported dataset');
    }
    case Dataset.ERRORS:
    case Dataset.ISSUE_PLATFORM: {
      return DetectorDataset.ERRORS;
    }
    case Dataset.TRANSACTIONS:
    case Dataset.GENERIC_METRICS: {
      return DetectorDataset.TRANSACTIONS;
    }
    case Dataset.EVENTS_ANALYTICS_PLATFORM: {
      // Spans and logs use the same dataset
      if (eventTypes.includes(EventTypes.TRACE_ITEM_SPAN)) {
        return DetectorDataset.SPANS;
      }
      if (eventTypes.includes(EventTypes.TRACE_ITEM_LOG)) {
        return DetectorDataset.LOGS;
      }
      if (eventTypes.includes(EventTypes.TRANSACTION)) {
        return DetectorDataset.TRANSACTIONS;
      }
      throw new Error(`Unsupported event types`);
    }
    case Dataset.METRICS:
    case Dataset.SESSIONS:
      return DetectorDataset.RELEASES; // Maps metrics dataset to releases for crash rate
    default:
      unreachable(backendDataset);
      return DetectorDataset.ERRORS;
  }
};
