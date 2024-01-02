import constructSelector from 'sentry/views/replays/deadRageClick/constructSelector';
import getAriaLabel from 'sentry/views/replays/deadRageClick/getAriaLabel';
import {DeadRageSelectorItem} from 'sentry/views/replays/types';

export default function hydratedSelectorData(data, clickType?): DeadRageSelectorItem[] {
  return data.map(d => ({
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
