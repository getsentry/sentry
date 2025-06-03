import {useState} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useDetectorQueriesByIds} from 'sentry/views/automations/hooks';
import {useAutomationActions} from 'sentry/views/automations/hooks/utils';
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
  const queries = useDetectorQueriesByIds(automationIds);
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.ceil(queries.length / AUTOMATIONS_PER_PAGE);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const data = queries
    .map((query): ConnectedAutomationsData | undefined => {
      if (!query.data) {
        return undefined;
      }
      return {
        ...query.data,
        link: makeAutomationDetailsPathname(organization.slug, query.data.id),
        connected: canEdit
          ? {
              isConnected: connectedAutomationIds?.has(query.data.id),
              toggleConnected: () => toggleConnected?.(query.data.id),
            }
          : undefined,
      };
    })
    .filter((x): x is ConnectedAutomationsData => x !== undefined);

  const isLoading = queries.some(query => query.isPending);
  const isError = queries.some(query => query.isError);

  if (isError) {
    return <LoadingError />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const pagination = (
    <Flex justify="flex-end">
      <ButtonBar merged>
        <Button
          onClick={handlePreviousPage}
          disabled={currentPage === 0}
          aria-label={t('Previous page')}
          icon={<IconChevron direction="left" />}
          size="sm"
        />
        <Button
          onClick={handleNextPage}
          disabled={currentPage === totalPages - 1}
          aria-label={t('Next page')}
          icon={<IconChevron direction="right" />}
          size="sm"
        />
      </ButtonBar>
    </Flex>
  );

  if (canEdit) {
    return (
      <Flex column>
        <SimpleTable columns={connectedColumns} data={data} />
        {pagination}
      </Flex>
    );
  }

  return (
    <Flex column>
      <SimpleTable
        columns={baseColumns}
        data={data}
        fallback={t('No automations connected')}
      />
      {pagination}
    </Flex>
  );
}

interface BaseAutomationData extends Automation {
  link: string;
}

const baseColumns = defineColumns<BaseAutomationData>({
  name: {
    Header: () => t('Name'),
    Cell: ({value, row}) => <AutomationTitleCell name={value} href={row.link} />,
    width: 'minmax(0, 3fr)',
  },
  lastTriggered: {
    Header: () => t('Last Triggered'),
    Cell: ({value}) => <TimeAgoCell date={value} />,
  },
  actionFilters: {
    Header: () => t('Actions'),
    Cell: ({row}) => {
      const actions = useAutomationActions(row);
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
