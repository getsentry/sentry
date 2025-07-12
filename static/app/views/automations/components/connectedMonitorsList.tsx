import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';

export const MONITORS_PER_PAGE = 10;

type Props = {
  detectorCount: number | undefined;
  detectorQueryResults: UseApiQueryResult<Detector[], Error>;
  className?: string;
  connectedDetectorIds?: Set<string>;
  toggleConnected?: (detector: Detector) => void;
};

function Skeletons({canEdit, numberOfRows}: {canEdit: boolean; numberOfRows: number}) {
  return (
    <Fragment>
      {Array.from({length: numberOfRows}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
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
  detectorCount,
  detectorQueryResults,
  connectedDetectorIds,
  toggleConnected,
}: Props) {
  const canEdit = Boolean(connectedDetectorIds && typeof toggleConnected === 'function');
  const navigate = useNavigate();
  const location = useLocation();

  const {data: detectors, isLoading, isError, getResponseHeader} = detectorQueryResults;

  return (
    <Container>
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
            numberOfRows={detectorCount === undefined ? MONITORS_PER_PAGE : detectorCount}
          />
        )}
        {isError && <LoadingError />}
        {detectorCount === 0 && (
          <SimpleTable.Empty>{t('No monitors connected')}</SimpleTable.Empty>
        )}
        {detectors?.map(detector => (
          <SimpleTable.Row key={detector.id}>
            <SimpleTable.RowCell>
              <DetectorLink detector={detector} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="type">
              <DetectorTypeCell type={detector.type} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="last-issue">
              <IssueCell group={undefined} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell data-column-name="owner">
              <DetectorAssigneeCell assignee={detector.owner} />
            </SimpleTable.RowCell>
            {canEdit && (
              <SimpleTable.RowCell data-column-name="connected" justify="flex-end">
                <Button onClick={() => toggleConnected?.(detector)} size="sm">
                  {connectedDetectorIds?.has(detector.id)
                    ? t('Disconnect')
                    : t('Connect')}
                </Button>
              </SimpleTable.RowCell>
            )}
          </SimpleTable.Row>
        ))}
      </SimpleTableWithColumns>
      {/* {(detectorIds === undefined || detectorIds.length > MONITORS_PER_PAGE) && ( */}
      <StyledPagination
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
      {/* )} */}
    </Container>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 100px auto auto auto;

  margin-bottom: ${space(2)};

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

const StyledPagination = styled(Pagination)`
  margin-bottom: ${space(2)};
`;
