import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  AutomationListRow,
  AutomationListRowSkeleton,
} from 'sentry/views/automations/components/automationListTable/row';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';

type AutomationListTableProps = {
  automations: Automation[];
  isError: boolean;
  isPending: boolean;
  isSuccess: boolean;
};

function LoadingSkeletons() {
  return Array.from({length: AUTOMATION_LIST_PAGE_LIMIT}).map((_, index) => (
    <AutomationListRowSkeleton key={index} />
  ));
}

function AutomationListTable({
  automations,
  isPending,
  isError,
  isSuccess,
}: AutomationListTableProps) {
  return (
    <AutomationsSimpleTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell name="name">{t('Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="last-triggered">
          {t('Last Triggered')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="action">{t('Actions')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="projects">{t('Projects')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="connected-monitors">
          {t('Monitors')}
        </SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {isSuccess && automations.length === 0 && (
        <SimpleTable.Empty>{t('No automations found')}</SimpleTable.Empty>
      )}
      {isError && <LoadingError message={t('Error loading automations')} />}
      {isPending && <LoadingSkeletons />}
      {isSuccess &&
        automations.map(automation => (
          <AutomationListRow key={automation.id} automation={automation} />
        ))}
    </AutomationsSimpleTable>
  );
}

const AutomationsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  .last-triggered,
  .action,
  .projects,
  .connected-monitors {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2.5fr 1fr;

    .projects {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2.5fr 1fr 1fr;

    .action {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2.5fr 1fr 1fr 1fr;

    .last-triggered {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 3fr) 1fr 1fr 1fr 1fr;

    .connected-monitors {
      display: flex;
    }
  }
`;

export default AutomationListTable;
