import {constructSelector} from 'sentry/views/explore/replays/selectors/constructSelector';
import {getAriaLabel} from 'sentry/views/explore/replays/selectors/getAriaLabel';
import type {DeadRageSelectorItem} from 'sentry/views/explore/replays/types';

export function hydratedSelectorData(data: any, clickType?: any): DeadRageSelectorItem[] {
  return data.map((d: any) => ({
    ...(clickType
      ? {[clickType]: d[clickType]}
      : {
          count_dead_clicks: d.count_dead_clicks,
          count_rage_clicks: d.count_rage_clicks,
        }),

    dom_element: {
      fullSelector: constructSelector(d.element).fullSelector,
      selector: constructSelector(d.element).selector,
      projectId: d.project_id,
    },

    element: d.dom_element.split(/[#.[]+/)[0],
    aria_label: getAriaLabel(d.dom_element),
    project_id: d.project_id,
  }));
}
