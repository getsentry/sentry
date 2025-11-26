import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {t, tct} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {parseCursor} from 'sentry/utils/cursor';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

const DEFAULT_DETECTORS_PER_PAGE = 10;

type Props = React.HTMLAttributes<HTMLDivElement> & {
  cursor: string | undefined;
  /**
   * If null, all detectors will be fetched.
   */
  detectorIds: Automation['detectorIds'] | null;
  onCursor: CursorHandler;
  connectedDetectorIds?: Set<string>;
  emptyMessage?: string;
  limit?: number | null;
  openInNewTab?: boolean;
  projectIds?: number[];
  query?: string;
  toggleConnected?: (params: {detector: Detector}) => void;
};

function Skeletons({canEdit, numberOfRows}: {canEdit: boolean; numberOfRows: number}) {
  return (
    <Fragment>
      {Array.from({length: numberOfRows}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <div style={{width: '100%'}}>
              <Placeholder height="20px" width="50%" style={{marginBottom: '4px'}} />
              <Placeholder height="16px" width="20%" />
            </div>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="type">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="last-issue">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="owner">
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

export default function ConnectedMonitorsList({
  detectorIds,
  connectedDetectorIds,
  toggleConnected,
  emptyMessage = t('No monitors connected'),
  cursor,
  onCursor,
  limit = DEFAULT_DETECTORS_PER_PAGE,
  query,
  openInNewTab,
  projectIds,
  ...props
}: Props) {
  const canEdit = Boolean(connectedDetectorIds && typeof toggleConnected === 'function');

  const {
    data: detectors,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      ids: detectorIds ?? undefined,
      limit: limit ?? undefined,
      cursor,
      query,
      includeIssueStreamDetectors: true,
      projects: projectIds,
    },
    {enabled: detectorIds === null || detectorIds.length > 0}
  );

  const pageLinks = getResponseHeader?.('Link');
  const totalCount = getResponseHeader?.('X-Hits');
  const totalCountInt = totalCount ? parseInt(totalCount, 10) : 0;

  const paginationCaption = useMemo(() => {
    if (isLoading || !detectors || detectors?.length === 0 || limit === null) {
      return undefined;
    }

    const currentCursor = parseCursor(cursor);
    const offset = currentCursor?.offset ?? 0;
    const startCount = offset * limit + 1;
    const endCount = startCount + detectors.length - 1;

    return tct('[start]-[end] of [total]', {
      start: startCount.toLocaleString(),
      end: endCount.toLocaleString(),
      total: totalCountInt.toLocaleString(),
    });
  }, [detectors, isLoading, cursor, limit, totalCountInt]);

  return (
    <Container {...props}>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="type">
            {t('Type')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="last-issue">
            {t('Last Issue')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="owner">
            {t('Assignee')}
          </SimpleTable.HeaderCell>
          {canEdit && <SimpleTable.HeaderCell data-column-name="connected" />}
        </SimpleTable.Header>
        {isLoading && (
          <Skeletons
            canEdit={canEdit}
            numberOfRows={
              detectorIds === null
                ? (limit ?? DEFAULT_DETECTORS_PER_PAGE)
                : Math.min(detectorIds?.length ?? 0, DEFAULT_DETECTORS_PER_PAGE)
            }
          />
        )}
        {isError && <LoadingError />}
        {((isSuccess && detectors.length === 0) ||
          (detectorIds !== null && detectorIds.length === 0)) && (
          <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
        )}
        {isSuccess &&
          (detectorIds === null || detectorIds.length > 0) &&
          detectors.map(detector => (
            <SimpleTable.Row key={detector.id}>
              <SimpleTable.RowCell>
                <DetectorLink detector={detector} openInNewTab={openInNewTab} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="type">
                <DetectorTypeCell type={detector.type} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="last-issue">
                <IssueCell group={detector.latestGroup} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="owner">
                <DetectorAssigneeCell assignee={detector.owner} />
              </SimpleTable.RowCell>
              {canEdit && (
                <SimpleTable.RowCell data-column-name="connected" justify="end">
                  <Button onClick={() => toggleConnected?.({detector})} size="sm">
                    {connectedDetectorIds?.has(detector.id)
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
  grid-template-columns: 1fr 100px minmax(0, 0.8fr) auto auto;

  /*
    The connected column can be added/removed depending on props, so in order to
    have a constant width we have an auto grid column and set the width here.
  */
  [data-column-name='connected'] {
    width: 140px;
  }

  @container (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr 100px auto auto;

    [data-column-name='last-issue'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 100px auto;

    [data-column-name='owner'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr 100px;

    [data-column-name='type'] {
      display: none;
    }
  }
`;
