import type {CategoricalPlottable} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/plottable';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

export function plottablesCanBeVisualized(
  plottables: CategoricalPlottable[] | Plottable[]
) {
  return plottables.some(plottable => !plottable.isEmpty);
}
