import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useDrawer from 'sentry/components/globalDrawer';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import AutomationTitleCell from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {parseCursor} from 'sentry/utils/cursor';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationCreatePathname} from 'sentry/views/automations/pathnames';
import {ConnectAutomationsDrawer} from 'sentry/views/detectors/components/connectAutomationsDrawer';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';
import {useIssueStreamDetectorId} from 'sentry/views/detectors/utils/useIssueStreamDetectorId';

const AUTOMATIONS_PER_PAGE = 5;

type Props = {
  detector: Detector;
};

interface DetectorAutomationsTableProps {
  detectorId: string;
  emptyMessage: React.ReactNode;
  projectId: string;
  limit?: number;
}

function Skeletons({numberOfRows}: {numberOfRows: number}) {
  return (
    <Fragment>
      {Array.from({length: numberOfRows}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="action-filters">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="triggered-by">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

function DetectorAutomationsTable({
  detectorId,
  emptyMessage,
  projectId,
}: DetectorAutomationsTableProps) {
  const project = useProjectFromId({project_id: projectId});
  const issueStreamDetectorId = useIssueStreamDetectorId(projectId);
  const detectorIds = [detectorId, issueStreamDetectorId];
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const {
    data: automations,
    isLoading,
    isError,
    isSuccess,
    getResponseHeader,
  } = useAutomationsQuery(
    {
      detector: detectorIds.filter(defined),
      limit: AUTOMATIONS_PER_PAGE,
      cursor,
    },
    {
      enabled: detectorIds.every(defined),
    }
  );

  const pageLinks = getResponseHeader?.('Link');
  const totalCount = getResponseHeader?.('X-Hits');
  const totalCountInt = totalCount ? parseInt(totalCount, 10) : 0;

  const paginationCaption = useMemo(() => {
    if (!automations || automations.length === 0 || isLoading) {
      return undefined;
    }

    const currentCursor = parseCursor(cursor);
    const offset = currentCursor?.offset ?? 0;
    const startCount = offset * AUTOMATIONS_PER_PAGE + 1;
    const endCount = startCount + automations.length - 1;

    return tct('[start]-[end] of [total]', {
      start: startCount.toLocaleString(),
      end: endCount.toLocaleString(),
      total: totalCountInt.toLocaleString(),
    });
  }, [automations, isLoading, cursor, totalCountInt]);

  return (
    <Container>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="action-filters">
            {t('Actions')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell data-column-name="triggered-by">
            {t('Triggered By Issues')}
          </SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {isLoading && <Skeletons numberOfRows={AUTOMATIONS_PER_PAGE} />}
        {isError && <LoadingError />}
        {isSuccess && automations.length === 0 && (
          <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
        )}
        {isSuccess &&
          automations.map(automation => (
            <SimpleTable.Row
              key={automation.id}
              variant={automation.enabled ? 'default' : 'faded'}
            >
              <SimpleTable.RowCell>
                <AutomationTitleCell automation={automation} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="action-filters">
                <ActionCell actions={getAutomationActions(automation)} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell data-column-name="triggered-by">
                {automation.detectorIds.includes(detectorId) ? (
                  <Tooltip
                    title={t('This Alert is directly connected to the current monitor.')}
                    showUnderline
                  >
                    {t('From Monitor')}
                  </Tooltip>
                ) : (
                  <Tooltip
                    title={tct(
                      'This Alert can be triggered by all issues in [projectName].',
                      {
                        projectName: project ? (
                          <strong>{project.slug}</strong>
                        ) : (
                          'project'
                        ),
                      }
                    )}
                    showUnderline
                  >
                    {t('In Project')}
                  </Tooltip>
                )}
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
      </SimpleTableWithColumns>
      <Pagination
        onCursor={setCursor}
        pageLinks={pageLinks}
        caption={totalCountInt > AUTOMATIONS_PER_PAGE ? paginationCaption : null}
      />
    </Container>
  );
}

export function DetectorDetailsAutomations({detector}: Props) {
  const organization = useOrganization();
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const {mutate: updateDetector} = useUpdateDetector();
  const canEditWorkflowConnections = useCanEditDetectorWorkflowConnections({
    projectId: detector.projectId,
  });

  const setWorkflowIds = useCallback(
    (newWorkflowIds: string[]) => {
      addLoadingMessage();
      updateDetector(
        {
          detectorId: detector.id,
          workflowIds: newWorkflowIds,
        },
        {
          onSuccess: () => {
            addSuccessMessage(t('Connected alerts updated'));
          },
        }
      );
    },
    [detector.id, updateDetector]
  );

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectAutomationsDrawer
          initialWorkflowIds={detector.workflowIds}
          setWorkflowIds={setWorkflowIds}
        />
      ),
      {ariaLabel: t('Connect Alerts')}
    );
  };

  const permissionTooltipText = canEditWorkflowConnections
    ? undefined
    : t(
        'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
        {
          settingsLink: (
            <Link
              to={{
                pathname: `/settings/${organization.slug}/`,
                hash: 'alertsMemberWrite',
              }}
            />
          ),
        }
      );

  return (
    <Section
      title={t('Connected Alerts')}
      trailingItems={
        <Button
          size="xs"
          onClick={toggleDrawer}
          disabled={!canEditWorkflowConnections}
          title={permissionTooltipText}
        >
          {t('Edit Connected Alerts')}
        </Button>
      }
    >
      <ErrorBoundary mini>
        <DetectorAutomationsTable
          detectorId={detector.id}
          projectId={detector.projectId}
          emptyMessage={
            <Stack gap="xl" align="center">
              <Stack gap="sm" align="center">
                <Button
                  size="sm"
                  onClick={toggleDrawer}
                  disabled={!canEditWorkflowConnections}
                  title={permissionTooltipText}
                >
                  {t('Connect Existing Alerts')}
                </Button>
                <LinkButton
                  href={makeAutomationCreatePathname(organization.slug, {
                    connectedIds: [detector.id],
                  })}
                  external
                  size="sm"
                  icon={<IconAdd />}
                  disabled={!canEditWorkflowConnections}
                  title={permissionTooltipText}
                >
                  {t('Create a New Alert')}
                </LinkButton>
              </Stack>
            </Stack>
          }
        />
      </ErrorBoundary>
    </Section>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 180px auto;
  margin-bottom: ${space(2)};

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 180px;

    [data-column-name='triggered-by'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr 120px;
  }
`;
