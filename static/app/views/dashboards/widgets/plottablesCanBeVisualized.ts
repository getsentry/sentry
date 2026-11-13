import type {CategoricalPlottable} from './categoricalSeriesWidget/plottables/plottable';
import type {HeatMapPlottable} from './heatMapWidget/plottables/heatMapPlottable';
import type {Plottable} from './timeSeriesWidget/plottables/plottable';

export function plottablesCanBeVisualized(
  plottables: CategoricalPlottable[] | Plottable[] | HeatMapPlottable[]
) {
  return plottables.some(plottable => !plottable.isEmpty);
}
