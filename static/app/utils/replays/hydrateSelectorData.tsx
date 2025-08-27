import constructSelector from 'sentry/views/replays/selectors/constructSelector';
import getAriaLabel from 'sentry/views/replays/selectors/getAriaLabel';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
  DeadRageSelectorQueryParams,
} from 'sentry/views/replays/types';

export default function hydrateSelectorData(
  data: DeadRageSelectorListResponse['data'],
  sort?: null | DeadRageSelectorQueryParams['sort']
): DeadRageSelectorItem[] {
  const clickType = sort
    ? sort === 'count_dead_clicks'
      ? 'count_dead_clicks'
      : 'count_rage_clicks'
    : null;
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

    element: d.dom_element.split(/[#.[]+/)[0] ?? '',
    aria_label: getAriaLabel(d.dom_element),
    project_id: d.project_id,
  }));
}
