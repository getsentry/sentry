import {ExtrapolationMode} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

export function useIsMigratedExtrapolation({
  extrapolationMode,
  dataset,
}: {
  dataset: DetectorDataset;
  extrapolationMode: ExtrapolationMode | undefined;
}) {
  return getIsMigratedExtrapolation({dataset, extrapolationMode});
}

export function getIsMigratedExtrapolation({
  dataset,
  extrapolationMode,
}: {
  dataset: DetectorDataset;
  extrapolationMode: ExtrapolationMode | undefined;
}) {
  return !!(
    dataset === DetectorDataset.SPANS &&
    extrapolationMode &&
    (extrapolationMode === ExtrapolationMode.SERVER_WEIGHTED ||
      extrapolationMode === ExtrapolationMode.NONE)
  );
}
