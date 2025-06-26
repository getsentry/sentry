import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';

const AUTOMATIONS_PER_PAGE = 10;

type Props = {
  automationIds: Detector['workflowIds'];
  connectedAutomationIds?: Set<string>;
  toggleConnected?: (id: string) => void;
};

function Skeletons({canEdit}: {canEdit: boolean}) {
  return (
    <Fragment>
      {Array.from({length: AUTOMATIONS_PER_PAGE}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell className="name">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell className="last-triggered">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell className="action-filters">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          {canEdit && (
            <SimpleTable.RowCell className="connected">
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
}: Props) {
  const canEdit = Boolean(
    connectedAutomationIds && typeof toggleConnected === 'function'
  );
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: automations,
    isLoading,
    isError,
    isSuccess,
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

  return (
    <Container>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell className="name">{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell className="last-triggered">
            {t('Last Triggered')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell className="action-filters">
            {t('Actions')}
          </SimpleTable.HeaderCell>
          {canEdit && <SimpleTable.HeaderCell className="connected" />}
        </SimpleTable.Header>
        {isLoading && <Skeletons canEdit={canEdit} />}
        {isError && <LoadingError />}
        {automationIds.length === 0 && (
          <SimpleTable.Empty>{t('No automations connected')}</SimpleTable.Empty>
        )}
        {isSuccess &&
          automations.map(automation => (
            <SimpleTable.Row
              key={automation.id}
              variant={automation.disabled ? 'faded' : 'default'}
            >
              <SimpleTable.RowCell className="name">
                <AutomationTitleCell automation={automation} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell className="last-triggered">
                <TimeAgoCell date={automation.lastTriggered} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell className="action-filters">
                <ActionCell actions={getAutomationActions(automation)} />
              </SimpleTable.RowCell>
              {canEdit && (
                <SimpleTable.RowCell className="connected" justify="flex-end">
                  <Button onClick={() => toggleConnected?.(automation.id)} size="sm">
                    {connectedAutomationIds?.has(automation.id)
                      ? t('Disconnect')
                      : t('Connect')}
                  </Button>
                </SimpleTable.RowCell>
              )}
            </SimpleTable.Row>
          ))}
      </SimpleTableWithColumns>
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
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 200px 180px auto;

  /*
    The connected column can be added/removed depending on props, so in order to
    have a constant width we have an auto grid column and set the width here.
    */
  .connected {
    width: 140px;
  }

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 180px auto;

    .last-triggered {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr auto;

    .action-filters {
      display: none;
    }
  }
`;
