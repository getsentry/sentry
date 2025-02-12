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
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import {traceAnalytics} from './traceAnalytics';
import {getCustomInstrumentationLink} from './traceConfigurations';
import {TraceShortcutsModal} from './traceShortcutsModal';
import {useHasTraceNewUi} from './useHasTraceNewUi';

function TraceActionsMenu({
  rootEventResults,
  traceEventView,
}: {
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
}) {
  const hasTraceNewUi = useHasTraceNewUi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();

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
          key: 'trace_events_in_discover_button',
          label: t('Open Events in Discover'),
          onAction: () => {
            trackAnalytics('performance_views.trace_view.open_in_discover', {
              organization,
            });
            const target = traceEventView.getResultsViewUrlTarget(
              organization,
              false,
              hasDatasetSelector(organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            );
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
