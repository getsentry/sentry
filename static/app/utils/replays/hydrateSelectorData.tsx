import constructSelector from 'sentry/views/replays/deadRageClick/constructSelector';
import getAriaLabel from 'sentry/views/replays/deadRageClick/getAriaLabel';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
} from 'sentry/views/replays/types';

export default function hydratedSelectorData(
  data: DeadRageSelectorListResponse['data'],
  clickType: string | undefined
): DeadRageSelectorItem[] {
  return data.map(d => ({
    ...(clickType
      ? {[clickType]: d[clickType]}
      : {
          count_dead_clicks: d.count_dead_clicks,
          count_rage_clicks: d.count_rage_clicks,
        }),
    dom_element: {
      ...constructSelector(d.element),
      projectId: d.project_id,
    },
    element: d.dom_element.split(/[#.[]+/)[0],
    elementAttrs: d.element,
    aria_label: getAriaLabel(d.dom_element),
    project_id: d.project_id,
  }));
}
