import {Fragment, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {getPaginationCaption, Pagination} from 'sentry/components/pagination';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

const LIMIT = 5;

interface Props {
  automationId: string;
}

function ConnectedProjectRow({projectId}: {projectId: string}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  if (!project) {
    return null;
  }
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <ProjectBadge
          project={project}
          to={`/organizations/${organization.slug}/issues/?project=${project.id}`}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

export function ConnectedProjectsList({automationId}: Props) {
  const organization = useOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const {data, isPending, isError, isSuccess} = useQuery({
    ...detectorListApiOptions(organization, {
      query: `type:issue_stream workflow:${automationId}`,
      includeIssueStreamDetectors: true,
      limit: LIMIT,
      cursor,
    }),
    select: selectJsonWithHeaders,
  });

  const detectors = data?.json ?? [];
  const pageLinks = data?.headers.Link;
  const totalCountInt = data?.headers['X-Hits'] ?? 0;

  const paginationCaption = isPending
    ? undefined
    : getPaginationCaption({
        cursor,
        limit: LIMIT,
        pageLength: detectors.length,
        total: totalCountInt,
      });

  return (
    <Container>
      <SimpleTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {isPending && (
          <Fragment>
            {Array.from({length: LIMIT}).map((_, i) => (
              <SimpleTable.Row key={i}>
                <SimpleTable.RowCell>
                  <Placeholder height="20px" width="200px" />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </Fragment>
        )}
        {isError && <LoadingError />}
        {isSuccess && detectors.length === 0 && (
          <SimpleTable.Empty>{t('No projects connected')}</SimpleTable.Empty>
        )}
        {isSuccess &&
          detectors.map(detector => {
            return (
              <ConnectedProjectRow key={detector.id} projectId={detector.projectId} />
            );
          })}
      </SimpleTable>
      <Pagination
        onCursor={setCursor}
        pageLinks={pageLinks}
        caption={paginationCaption}
      />
    </Container>
  );
}
