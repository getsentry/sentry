import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';

type LegendSelection = Record<string, boolean>;

type Props = {
  dashboard: DashboardDetails;
  organization: Organization;
};

export class LocalWidgetLegendSelectionState extends WidgetLegendSelectionState {
  private readonly selectionByWidget = new Map<string, LegendSelection>();

  constructor({dashboard, organization}: Props) {
    super({
      dashboard,
      organization,
      location: {
        hash: '',
        key: 'seer-embed',
        pathname: '',
        query: {},
        search: '',
        state: undefined,
      } as Location,
      navigate: () => {},
    });
  }

  override setWidgetSelectionState(selected: LegendSelection, widget: Widget) {
    this.selectionByWidget.set(this.getWidgetKey(widget), selected);
  }

  override getWidgetSelectionState(widget: Widget): LegendSelection {
    return (
      this.selectionByWidget.get(this.getWidgetKey(widget)) ??
      super.getWidgetSelectionState(widget)
    );
  }

  private getWidgetKey(widget: Widget): string {
    return widget.id ?? widget.tempId ?? widget.title;
  }
}
