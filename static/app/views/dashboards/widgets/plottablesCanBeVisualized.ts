import type {CategoricalPlottable} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/plottable';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

import type {HeatMapPlottable} from './heatMapWidget/plottables/heatMapPlottable';

export function plottablesCanBeVisualized(
  plottables: CategoricalPlottable[] | Plottable[] | HeatMapPlottable[]
) {
  return plottables.some(plottable => !plottable.isEmpty);
}
