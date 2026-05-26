import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {useQueryClient} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {getPaginationCaption, Pagination} from '@sentry/scraps/pagination';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {AutomationTitleCell} from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {AutomationBuilderDrawerForm} from 'sentry/views/automations/components/automationBuilderDrawerForm';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {ConnectAutomationsDrawer} from 'sentry/views/detectors/components/connectAutomationsDrawer';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';
import {useIssueStreamDetectorsForProject} from 'sentry/views/detectors/utils/useIssueStreamDetectorsForProject';

const AUTOMATIONS_PER_PAGE = 5;

type Props = {
  detector: Detector;
};

interface AutomationsTableProps {
  detectorId: string;
  emptyMessage: React.ReactNode;
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
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

function AutomationsTable({detectorId, emptyMessage}: AutomationsTableProps) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const onSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCursor(undefined);
  }, []);

  const org = useOrganization();
  const {data, isPending, isError, isSuccess} = useQuery({
    ...automationsApiOptions(org, {
      detector: [detectorId],
      limit: AUTOMATIONS_PER_PAGE,
      cursor,
      query: searchQuery || undefined,
    }),
    select: selectJsonWithHeaders,
  });

  const automations = data?.json;
  const pageLinks = data?.headers.Link;
  const totalCountInt = data?.headers['X-Hits'] ?? 0;

  const paginationCaption =
    isPending || !automations
      ? undefined
      : getPaginationCaption({
          cursor,
          limit: AUTOMATIONS_PER_PAGE,
          pageLength: automations.length,
          total: totalCountInt,
        });

  const table = (
    <SimpleTableWithColumns>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell data-column-name="action-filters">
          {t('Actions')}
        </SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {isPending && <Skeletons numberOfRows={AUTOMATIONS_PER_PAGE} />}
      {isError && <LoadingError />}
      {isSuccess && automations?.length === 0 && (
        <SimpleTable.Empty>
          {searchQuery ? t('No matching alerts found') : emptyMessage}
        </SimpleTable.Empty>
      )}
      {isSuccess &&
        automations?.map(automation => (
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
          </SimpleTable.Row>
        ))}
    </SimpleTableWithColumns>
  );

  return (
    <Container>
      <Stack gap="md">
        <AutomationSearch initialQuery={searchQuery} onSearch={onSearch} />
        {table}
      </Stack>
      <Pagination
        onCursor={setCursor}
        pageLinks={pageLinks}
        caption={paginationCaption}
      />
    </Container>
  );
}

export function DetectorDetailsAutomations({detector}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const {mutate: updateDetector} = useUpdateDetector();
  const project = useProjectFromId({project_id: detector.projectId});
  const canEditWorkflowConnections = useCanEditDetectorWorkflowConnections({
    projectId: detector.projectId,
  });

  const {
    data: issueStreamDetectors,
    isError: issueStreamDetectorsError,
    refetch: refetchIssueStreamDetectors,
  } = useIssueStreamDetectorsForProject(detector.projectId);
  const issueStreamDetectorId = issueStreamDetectors?.[0]?.id;

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
            queryClient.invalidateQueries({
              queryKey: automationsApiOptions(organization).queryKey,
            });
          },
        }
      );
    },
    [detector.id, updateDetector, queryClient, organization]
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

  const openCreateDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
    }

    openDrawer(
      () => (
        <AutomationBuilderDrawerForm
          closeDrawer={closeDrawer}
          initialData={{detectorIds: [detector.id]}}
          onSuccess={() => {
            closeDrawer();
          }}
        />
      ),
      {ariaLabel: t('Create New Alert')}
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
    <Fragment>
      <DetailSection
        title={t('Connected Alerts')}
        trailingItems={
          <Flex gap="sm">
            <Button
              size="xs"
              icon={<IconAdd />}
              onClick={openCreateDrawer}
              disabled={!canEditWorkflowConnections}
              tooltipProps={{title: permissionTooltipText}}
            >
              {t('New Alert')}
            </Button>
            <Button
              size="xs"
              onClick={toggleDrawer}
              disabled={!canEditWorkflowConnections}
              tooltipProps={{title: permissionTooltipText}}
              icon={<IconEdit />}
            >
              {t('Edit Alerts')}
            </Button>
          </Flex>
        }
      >
        <ErrorBoundary mini>
          <AutomationsTable
            detectorId={detector.id}
            emptyMessage={
              project ? (
                <Stack gap="md" align="center">
                  <Button
                    size="sm"
                    onClick={toggleDrawer}
                    disabled={!canEditWorkflowConnections}
                    tooltipProps={{title: permissionTooltipText}}
                  >
                    {t('Connect Existing Alerts')}
                  </Button>
                  <Button
                    size="sm"
                    icon={<IconAdd />}
                    onClick={openCreateDrawer}
                    disabled={!canEditWorkflowConnections}
                    tooltipProps={{title: permissionTooltipText}}
                  >
                    {t('Create a New Alert')}
                  </Button>
                </Stack>
              ) : (
                t('No alerts connected')
              )
            }
          />
        </ErrorBoundary>
      </DetailSection>

      {issueStreamDetectorsError && (
        <LoadingError
          message={t('Error loading project alerts')}
          onRetry={refetchIssueStreamDetectors}
        />
      )}

      {issueStreamDetectorId && (
        <DetailSection
          title={t('Project Alerts')}
          description={
            project
              ? tct(
                  'Issues created by this monitor may also trigger alerts connected to [project].',
                  {
                    project: (
                      <InlineProjectName display="inline-flex" align="center" gap="xs">
                        <ProjectAvatar project={project} size={14} />
                        <strong>{project.slug}</strong>
                      </InlineProjectName>
                    ),
                  }
                )
              : undefined
          }
        >
          <ErrorBoundary mini>
            <AutomationsTable
              detectorId={issueStreamDetectorId}
              emptyMessage={t('No alerts connected to this project')}
            />
          </ErrorBoundary>
        </DetailSection>
      )}
    </Fragment>
  );
}

const Container = styled('div')`
  container-type: inline-size;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 180px;

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr 120px;
  }
`;

const InlineProjectName = styled(Flex)`
  vertical-align: bottom;
`;
