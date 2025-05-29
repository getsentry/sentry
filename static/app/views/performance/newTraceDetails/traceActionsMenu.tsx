import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {getTraceProject} from 'sentry/views/performance/newTraceDetails/tracePreferencesDropdown';
import {useHasTraceTabsUI} from 'sentry/views/performance/newTraceDetails/useHasTraceTabsUI';

import type {TraceRootEventQueryResults} from './traceApi/useTraceRootEvent';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from './traceDrawer/details/utils';
import {traceAnalytics} from './traceAnalytics';
import {getCustomInstrumentationLink} from './traceConfigurations';
import {TraceShortcutsModal} from './traceShortcutsModal';

function TraceActionsMenu({
  traceSlug,
  rootEventResults,
  traceEventView,
}: {
  rootEventResults: TraceRootEventQueryResults;
  traceEventView: EventView;
  traceSlug: string | undefined;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const hasTraceTabsUi = useHasTraceTabsUI();

  if (hasTraceTabsUi) {
    return null;
  }

  const traceProject = getTraceProject(projects, rootEventResults);

  return (
    <DropdownMenu
      items={[
        {
          key: 'open_trace_events',
          label: hasExploreEnabled
            ? t('Open Events in Explore')
            : t('Open Events in Discover'),
          onAction: () => {
            let target:
              | ReturnType<typeof getSearchInExploreTarget>
              | ReturnType<typeof traceEventView.getResultsViewUrlTarget>;

            if (hasExploreEnabled) {
              const key = 'trace';
              const value = traceSlug ?? '';

              traceAnalytics.trackExploreSearch(
                organization,
                'trace',
                traceSlug ?? '',
                TraceDrawerActionKind.INCLUDE,
                'toolbar_menu'
              );

              const {start, end, statsPeriod} = traceEventView;
              target = getSearchInExploreTarget(
                organization,
                {
                  ...location,
                  query: {
                    start,
                    end,
                    statsPeriod: start && end ? null : statsPeriod, // We don't want statsPeriod to have precedence over start and end
                  },
                },
                '-1',
                key,
                value,
                TraceDrawerActionKind.INCLUDE
              );
            } else {
              trackAnalytics('performance_views.trace_view.open_in_discover', {
                organization,
              });
              target = traceEventView.getResultsViewUrlTarget(
                organization,
                false,
                hasDatasetSelector(organization)
                  ? SavedQueryDatasets.TRANSACTIONS
                  : undefined
              );
            }

            navigate(target);
          },
        },
        {
          key: 'shortcuts_button',
          label: t('See Shortcuts'),
          onAction: () => {
            traceAnalytics.trackViewShortcuts(organization);
            openModal(props => <TraceShortcutsModal {...props} />);
          },
        },
        {
          key: 'external-actions',
          children: [
            {
              key: 'custom_instrumentation_button',
              label: t('Add Instrumentation'),
              externalHref: getCustomInstrumentationLink(traceProject),
              leadingItems: <IconOpen />,
            },
          ],
        },
      ]}
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          aria-label={t('Discover Context Menu')}
          size="xs"
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();

            triggerProps.onClick?.(e);
          }}
          icon={<IconEllipsis />}
        />
      )}
      position="bottom-end"
    />
  );
}

export default TraceActionsMenu;
