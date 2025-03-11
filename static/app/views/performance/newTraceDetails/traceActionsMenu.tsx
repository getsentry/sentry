import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from './traceDrawer/details/utils';
import {traceAnalytics} from './traceAnalytics';
import {getCustomInstrumentationLink} from './traceConfigurations';
import {TraceShortcutsModal} from './traceShortcutsModal';
import {useHasTraceNewUi} from './useHasTraceNewUi';

function TraceActionsMenu({
  traceSlug,
  rootEventResults,
  traceEventView,
}: {
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string | undefined;
}) {
  const location = useLocation();
  const hasTraceNewUi = useHasTraceNewUi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const hasDrawerAction = organization.features.includes('trace-drawer-action');

  if (!hasTraceNewUi) {
    return null;
  }

  const traceProject = rootEventResults.data
    ? projects.find(p => p.id === rootEventResults.data.projectID)
    : undefined;

  return (
    <DropdownMenu
      items={[
        {
          key: 'open_trace_events',
          label: hasDrawerAction
            ? t('Open Events in Explore')
            : t('Open Events in Discover'),
          onAction: () => {
            let target;

            if (hasDrawerAction) {
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
          key: 'custom_instrumentation_button',
          label: t('Add Instrumentation'),
          onAction: () => {
            const docsLink = getCustomInstrumentationLink(traceProject);
            if (docsLink) {
              window.location.href = docsLink;
            }
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
