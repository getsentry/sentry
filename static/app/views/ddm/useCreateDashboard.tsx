import {useMemo} from 'react';

import {openCreateDashboardFromScratchpad} from 'sentry/actionCreators/modal';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';

export function useCreateDashboard() {
  const router = useRouter();
  const organization = useOrganization();
  const {widgets} = useDDMContext();
  const {selection} = usePageFilters();

  return useMemo(() => {
    return function (scratchpad?: {name: string}) {
      const newDashboard = {
        title: scratchpad?.name || 'Metrics Dashboard',
        description: '',
        widgets: widgets
          .filter(widget => !!widget.mri)
          .map(widget =>
            // @ts-expect-error TODO(ogi): fix this
            convertToDashboardWidget(widget, widget.displayType)
          )
          // Only import the first 30 widgets because of dashboard widget limit
          .slice(0, 30),
        projects: selection.projects,
        environment: selection.environments,
        start: selection.datetime.start as string,
        end: selection.datetime.end as string,
        period: selection.datetime.period as string,
        filters: {},
        utc: selection.datetime.utc ?? false,
        id: 'ddm-scratchpad',
        dateCreated: '',
      };

      openCreateDashboardFromScratchpad({newDashboard, router, organization});
    };
  }, [selection, widgets, organization, router]);
}
