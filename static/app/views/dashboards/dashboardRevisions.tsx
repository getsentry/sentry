import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconClock} from 'sentry/icons/iconClock';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useDashboardRevisions} from './hooks/useDashboardRevisions';
import {RevisionListItem} from './revisionListItem';
import type {DashboardDetails} from './types';

// --- Components ---

const NEWEST_VERSION_ID = '__current__';
const MAX_DISPLAYED_REVISIONS = 10;

interface DashboardRevisionsButtonProps {
  dashboard: DashboardDetails;
}

export function DashboardRevisionsButton({dashboard}: DashboardRevisionsButtonProps) {
  if (!dashboard.id || defined(dashboard.prebuiltId)) {
    return null;
  }

  const handleClick = () => {
    openModal(props => <DashboardRevisionsModal {...props} dashboard={dashboard} />, {
      modalCss: css`
        max-width: 720px;
        width: 90vw;
      `,
    });
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
  Footer,
  closeModal,
  dashboard,
}: ModalRenderProps & {
  dashboard: DashboardDetails;
}) {
  const dashboardId = dashboard.id;
  const [selectedRevisionId, setSelectedRevisionId] = useState(NEWEST_VERSION_ID);
  const {data: revisions, isPending, isError} = useDashboardRevisions({dashboardId});
  const displayedRevisions = revisions?.slice(0, MAX_DISPLAYED_REVISIONS) ?? [];
  const isNewestVersionSelected = selectedRevisionId === NEWEST_VERSION_ID;
  const selectedRevision = isNewestVersionSelected
    ? null
    : (displayedRevisions.find(r => r.id === selectedRevisionId) ?? null);

  const api = useApi();
  const organization = useOrganization();
  const {
    mutate: restore,
    isPending: isRestoring,
    isError: isRestoreError,
  } = useMutation({
    mutationFn: () => {
      if (!selectedRevision) {
        return Promise.reject(new Error('No revision selected'));
      }
      return api.requestPromise(
        `/organizations/${organization.slug}/dashboards/${dashboardId}/revisions/${selectedRevision.id}/restore/`,
        {method: 'POST'}
      );
    },
    onSuccess: () => {
      closeModal();
      testableWindowLocation.assign(window.location.pathname);
    },
  });

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Edit History')}</Heading>
      </Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <Alert variant="danger">{t('Failed to load dashboard revisions.')}</Alert>
        ) : (
          <Flex direction="column" gap="md">
            {isRestoreError && (
              <Alert variant="danger">{t('Failed to restore this revision.')}</Alert>
            )}
            <Flex
              direction="column"
              style={{maxHeight: 'min(560px, calc(100vh - 350px))'}}
              overflowY="auto"
            >
              <RevisionListItem
                isCurrentVersion
                isSelected={isNewestVersionSelected}
                onSelect={() => setSelectedRevisionId(NEWEST_VERSION_ID)}
                revisionSource={revisions?.[0]?.source ?? 'edit'}
                createdBy={revisions?.[0]?.createdBy ?? dashboard.createdBy ?? null}
                dateCreated={null}
                dashboardId={dashboardId}
                baseRevisionId={displayedRevisions[0]?.id ?? null}
                snapshotOverride={dashboard}
              />
              {displayedRevisions.map((revision, index) => (
                <RevisionListItem
                  key={revision.id}
                  isSelected={revision.id === selectedRevisionId}
                  onSelect={() => setSelectedRevisionId(revision.id)}
                  // Each revision is saved before the operation that produces it,
                  // so the label and author for this entry come from the following revision.
                  revisionSource={revisions?.[index + 1]?.source ?? 'edit'}
                  createdBy={revisions?.[index + 1]?.createdBy ?? null}
                  dateCreated={revision.dateCreated}
                  dashboardId={dashboardId}
                  revisionId={revision.id}
                  baseRevisionId={revisions?.[index + 1]?.id ?? null}
                />
              ))}
            </Flex>
          </Flex>
        )}
      </Body>
      {displayedRevisions.length ? (
        <Footer>
          <Flex gap="sm">
            <Button size="sm" onClick={closeModal}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => restore()}
              busy={isRestoring}
              disabled={isNewestVersionSelected}
            >
              {t('Revert to Selection')}
            </Button>
          </Flex>
        </Footer>
      ) : null}
    </Fragment>
  );
}
