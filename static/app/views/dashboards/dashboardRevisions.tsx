import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons/iconClock';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import type {DashboardRevision} from './hooks/useDashboardRevisions';
import {useDashboardRevisions} from './hooks/useDashboardRevisions';
import type {DashboardDetails} from './types';

interface DashboardRevisionsButtonProps {
  dashboard: DashboardDetails;
}

export function DashboardRevisionsButton({dashboard}: DashboardRevisionsButtonProps) {
  if (
    !dashboard.id ||
    dashboard.id === 'default-overview' ||
    defined(dashboard.prebuiltId)
  ) {
    return null;
  }

  const handleClick = () => {
    openModal(props => <DashboardRevisionsModal {...props} dashboardId={dashboard.id} />);
  };

  return (
    <Tooltip title={t('Dashboard Revisions')}>
      <Button
        size="sm"
        icon={<IconClock />}
        aria-label={t('Dashboard Revisions')}
        onClick={handleClick}
      />
    </Tooltip>
  );
}

function DashboardRevisionsModal({
  Header,
  Body,
  dashboardId,
}: ModalRenderProps & {
  dashboardId: string;
}) {
  const {data: revisions, isPending, isError} = useDashboardRevisions({dashboardId});

  return (
    <Fragment>
      <Header closeButton>{t('Dashboard Revisions')}</Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <Alert variant="danger">{t('Failed to load dashboard revisions.')}</Alert>
        ) : revisions?.length ? (
          <RevisionList revisions={revisions} />
        ) : (
          <Flex align="center" justify="center" padding="xl">
            <Text variant="muted">{t('No revisions found.')}</Text>
          </Flex>
        )}
      </Body>
    </Fragment>
  );
}

function RevisionList({revisions}: {revisions: DashboardRevision[]}) {
  return (
    <RevisionsTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Title')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Created By')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Created At')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {revisions.map(revision => (
        <SimpleTable.Row key={revision.id}>
          <SimpleTable.RowCell>
            <Flex align="center" gap="sm">
              <Text size="sm">{revision.title}</Text>
              {revision.source === 'pre-restore' && (
                <Tag variant="muted">{t('pre-restore')}</Tag>
              )}
            </Flex>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text size="sm" variant="muted">
              {revision.createdBy
                ? revision.createdBy.name || revision.createdBy.email
                : t('Unknown')}
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <TimeSince date={revision.dateCreated} />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </RevisionsTable>
  );
}

const RevisionsTable = styled(SimpleTable)`
  grid-template-columns: minmax(200px, 2fr) minmax(150px, 1fr) minmax(120px, auto);
`;
