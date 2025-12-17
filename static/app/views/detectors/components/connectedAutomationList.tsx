import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {parseCursor} from 'sentry/utils/cursor';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';

const DEFAULT_AUTOMATIONS_PER_PAGE = 10;

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * If null, all automations will be fetched.
   */
  automationIds: Detector['workflowIds'] | null;
  cursor: string | undefined;
  onCursor: CursorHandler;
  connectedAutomationIds?: Set<string>;
  emptyMessage?: React.ReactNode;
  limit?: number | null;
  openInNewTab?: boolean;
  query?: string;
  toggleConnected?: (params: {automation: Automation}) => void;
};

function Skeletons({canEdit, numberOfRows}: {canEdit: boolean; numberOfRows: number}) {
  return (
    <Fragment>
      {Array.from({length: numberOfRows}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="last-triggered">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="action-filters">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          {canEdit && (
            <SimpleTable.RowCell data-column-name="connected">
              <Placeholder height="20px" />
            </SimpleTable.RowCell>
          )}
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

export function ConnectedAutomationsList({
  automationIds,
  connectedAutomationIds,
  toggleConnected,
  emptyMessage = t('No alerts connected'),
  cursor,
  onCursor,
  limit = DEFAULT_AUTOMATIONS_PER_PAGE,
  query,
  openInNewTab,
  ...props
}: Props) {
  const canEdit = Boolean(
    connectedAutomationIds && typeof toggleConnected === 'function'
  );

  const {
    data: automations,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useAutomationsQuery(
    {
      ids: automationIds ?? undefined,
      limit: limit ?? undefined,
      cursor,
      query,
    },
    {enabled: automationIds === null || automationIds.length > 0}
  );

  const pageLinks = getResponseHeader?.('Link');
  const totalCount = getResponseHeader?.('X-Hits');
  const totalCountInt = totalCount ? parseInt(totalCount, 10) : 0;

  const paginationCaption = useMemo(() => {
    if (!automations || automations.length === 0 || isLoading || limit === null) {
      return undefined;
    }

    const currentCursor = parseCursor(cursor);
    const offset = currentCursor?.offset ?? 0;
    const startCount = offset * limit + 1;
    const endCount = startCount + automations.length - 1;

    return tct('[start]-[end] of [total]', {
      start: startCount.toLocaleString(),
      end: endCount.toLocaleString(),
      total: totalCountInt.toLocaleString(),
    });
  }, [automations, isLoading, cursor, limit, totalCountInt]);

  return (
    <Container {...props}>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="last-triggered">
            {t('Last Triggered')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="action-filters">
            {t('Actions')}
          </SimpleTable.HeaderCell>
          {canEdit && <SimpleTable.HeaderCell data-column-name="connected" />}
        </SimpleTable.Header>
        {isLoading && (
          <Skeletons
            canEdit={canEdit}
            numberOfRows={
              automationIds === null
                ? (limit ?? DEFAULT_AUTOMATIONS_PER_PAGE)
                : Math.min(automationIds?.length ?? 0, DEFAULT_AUTOMATIONS_PER_PAGE)
            }
          />
        )}
        {isError && <LoadingError />}
        {((isSuccess && automations.length === 0) ||
          (automationIds !== null && automationIds.length === 0)) && (
          <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
        )}
        {isSuccess &&
          automations.map(automation => (
            <SimpleTable.Row
              key={automation.id}
              variant={automation.enabled ? 'default' : 'faded'}
            >
              <SimpleTable.RowCell>
                <AutomationTitleCell
                  automation={automation}
                  openInNewTab={openInNewTab}
                />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="last-triggered">
                <TimeAgoCell date={automation.lastTriggered} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="action-filters">
                <ActionCell actions={getAutomationActions(automation)} />
              </SimpleTable.RowCell>
              {canEdit && (
                <SimpleTable.RowCell data-column-name="connected" justify="end">
                  <Button onClick={() => toggleConnected?.({automation})} size="sm">
                    {connectedAutomationIds?.has(automation.id)
                      ? t('Disconnect')
                      : t('Connect')}
                  </Button>
                </SimpleTable.RowCell>
              )}
            </SimpleTable.Row>
          ))}
      </SimpleTableWithColumns>
      {limit && (
        <Pagination
          onCursor={onCursor}
          pageLinks={pageLinks}
          caption={totalCountInt > limit ? paginationCaption : null}
        />
      )}
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 200px 180px auto;

  margin-bottom: ${space(2)};

  /*
    The connected column can be added/removed depending on props, so in order to
    have a constant width we have an auto grid column and set the width here.
    */
  [data-column-name='connected'] {
    width: 140px;
  }

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 180px auto;

    [data-column-name='last-triggered'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr auto;

    [data-column-name='action-filters'] {
      display: none;
    }
  }
`;
