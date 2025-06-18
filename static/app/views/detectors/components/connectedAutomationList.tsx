import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

const AUTOMATIONS_PER_PAGE = 10;

type Props = {
  automationIds: Detector['workflowIds'];
  connectedAutomationIds?: Set<string>;
  toggleConnected?: (id: string) => void;
};

export function ConnectedAutomationsList({
  automationIds,
  connectedAutomationIds,
  toggleConnected,
}: Props) {
  const organization = useOrganization();
  const canEdit = connectedAutomationIds && !!toggleConnected;
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: automations,
    isLoading,
    isError,
    getResponseHeader,
  } = useAutomationsQuery(
    {
      ids: automationIds,
      limit: AUTOMATIONS_PER_PAGE,
      cursor:
        typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
    },
    {enabled: automationIds.length > 0}
  );

  if (isError) {
    return <LoadingError />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const tableData: ConnectedAutomationsData[] =
    automations
      ?.map(automation => {
        return {
          ...automation,
          link: makeAutomationDetailsPathname(organization.slug, automation.id),
          connected: canEdit
            ? {
                isConnected: connectedAutomationIds?.has(automation.id),
                toggleConnected: () => toggleConnected?.(automation.id),
              }
            : undefined,
        };
      })
      .filter(defined) ?? [];

  return (
    <div>
      <SimpleTable
        columns={canEdit ? connectedColumns : baseColumns}
        data={tableData}
        fallback={t('No automations connected')}
      />
      <Pagination
        onCursor={cursor => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              cursor,
            },
          });
        }}
        pageLinks={getResponseHeader?.('Link')}
      />
    </div>
  );
}

interface BaseAutomationData extends Automation {
  link: string;
}

const baseColumns = defineColumns<BaseAutomationData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => (
      <AutomationTitleCell name={value} href={row.link} createdBy={row.createdBy} />
    ),
    width: 'minmax(0, 3fr)',
  },
  lastTriggered: {
    Header: () => t('Last Triggered'),
    Cell: ({value}) => <TimeAgoCell date={value} />,
  },
  actionFilters: {
    Header: () => t('Actions'),
    Cell: ({row}) => {
      const actions = getAutomationActions(row);
      return <ActionCell actions={actions} />;
    },
  },
});

interface ConnectedAutomationsData extends BaseAutomationData {
  connected?: {
    isConnected: boolean;
    toggleConnected: () => void;
  };
}

const connectedColumns = defineColumns<ConnectedAutomationsData>({
  ...baseColumns,
  connected: {
    Header: () => null,
    Cell: ({value}) =>
      value && (
        <Button onClick={value.toggleConnected}>
          {value.isConnected ? t('Disconnect') : t('Connect')}
        </Button>
      ),
    width: '1fr',
  },
});
