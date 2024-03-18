import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {space} from 'sentry/styles/space';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Query = {
  domain?: string;
  project?: string;
  transaction?: string;
  transactionMethod?: string;
};

export function HTTPSamplesPanel() {
  const location = useLocation<Query>();
  const query = location.query;

  const router = useRouter();

  const organization = useOrganization();

  const projectId = decodeScalar(query.project);

  const {projects} = useProjects();
  const project = projects.find(p => projectId === p.id);

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey =
    query.transaction && query.domain
      ? [query.domain, query.transactionMethod, query.transaction]
          .filter(Boolean)
          .join(':')
      : undefined;

  const handleClose = () => {
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        transaction: undefined,
        transactionMethod: undefined,
      },
    });
  };

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose}>
        <HeaderContainer>
          {project && (
            <SpanSummaryProjectAvatar
              project={project}
              direction="left"
              size={40}
              hasTooltip
              tooltip={project.slug}
            />
          )}
          <TitleContainer>
            <Title>
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/performance/summary?${qs.stringify(
                    {
                      project: query.project,
                      transaction: query.transaction,
                    }
                  )}`
                )}
              >
                {query.transaction &&
                query.transactionMethod &&
                !query.transaction.startsWith(query.transactionMethod)
                  ? `${query.transactionMethod} ${query.transaction}`
                  : query.transaction}
              </Link>
            </Title>
          </TitleContainer>
        </HeaderContainer>
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-right: ${space(1)};
`;

const HeaderContainer = styled('div')`
  width: 100%;
  padding-bottom: ${space(2)};
  padding-top: ${space(1)};

  display: grid;
  grid-template-rows: auto auto auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const TitleContainer = styled('div')`
  width: 100%;
  position: relative;
  height: 40px;
`;

const Title = styled('h4')`
  position: absolute;
  bottom: 0;
  margin-bottom: 0;
`;
