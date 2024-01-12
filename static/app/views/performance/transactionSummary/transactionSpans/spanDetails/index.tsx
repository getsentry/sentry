import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {getTransactionName} from '../../../utils';
import {NoAccess, redirectToPerformanceHomepage} from '../../pageLayout';
import {generateSpansEventView, parseSpanSlug} from '../utils';

import SpanDetailsContent from './content';

type Props = Pick<RouteComponentProps<{spanSlug: string}, {}>, 'location' | 'params'>;

export default function SpanDetails(props: Props) {
  const {location, params} = props;
  const transactionName = getTransactionName(location);
  const spanSlug = parseSpanSlug(params.spanSlug);

  const organization = useOrganization();
  const {projects} = useProjects();

  const projectId = decodeScalar(location.query.project);
  if (!defined(projectId) || !defined(transactionName) || !defined(spanSlug)) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  const project = projects.find(p => p.id === projectId);
  const eventView = generateSpansEventView({
    location,
    transactionName,
  });

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features="performance-view"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <PageFiltersContainer
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={defined(project) ? [project.slug] : []}
        >
          <Layout.Page>
            <SpanDetailsContent
              location={location}
              organization={organization}
              eventView={eventView}
              project={project}
              transactionName={transactionName}
              spanSlug={spanSlug}
            />
          </Layout.Page>
        </PageFiltersContainer>
      </Feature>
    </SentryDocumentTitle>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}
