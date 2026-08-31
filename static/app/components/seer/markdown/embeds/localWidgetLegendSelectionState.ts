import {useMemo, useReducer} from 'react';

import type {Organization} from 'sentry/types/organization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';

type LegendSelection = Record<string, boolean>;

type Props = {
  dashboard: DashboardDetails;
  organization: Organization;
};

type StateProps = Props & {
  onChange: () => void;
};

export class LocalWidgetLegendSelectionState extends WidgetLegendSelectionState {
  private readonly selectionByWidget = new Map<string, LegendSelection>();
  private readonly onChange: () => void;

  constructor({dashboard, onChange, organization}: StateProps) {
    super({
      dashboard,
      organization,
      location: {
        action: 'POP',
        hash: '',
        key: 'seer-embed',
        pathname: '',
        query: {},
        search: '',
        state: undefined,
      },
      navigate: () => {},
    });
    this.onChange = onChange;
  }

  override setWidgetSelectionState(selected: LegendSelection, widget: Widget) {
    this.selectionByWidget.set(this.getWidgetKey(widget), selected);
    this.onChange();
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

export function useLocalWidgetLegendSelectionState({dashboard, organization}: Props) {
  const [, rerender] = useReducer(count => count + 1, 0);

  return useMemo(
    () =>
      new LocalWidgetLegendSelectionState({
        dashboard,
        onChange: rerender,
        organization,
      }),
    [dashboard, organization]
  );
}
