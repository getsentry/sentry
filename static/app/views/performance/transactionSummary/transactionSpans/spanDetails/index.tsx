import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import GlobalSelectionHeader from 'sentry/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {getTransactionName} from '../../../utils';
import {NoAccess} from '../../pageLayout';
import {generateSpansEventView, parseSpanSlug} from '../utils';

import SpanDetailsContent from './content';

type Props = Pick<RouteComponentProps<{spanSlug: string}, {}>, 'location' | 'params'>;

export default function SpanDetails(props: Props) {
  const {location, params} = props;
  const transactionName = getTransactionName(location);
  const spanSlug = parseSpanSlug(params.spanSlug);

  const projectId = decodeScalar(location.query.project);
  if (!defined(projectId) || !defined(transactionName) || !defined(spanSlug)) {
    return null;
  }

  const organization = useOrganization();
  const {projects} = useProjects();

  const project = projects.find(p => p.id === projectId);
  const eventView = generateSpansEventView(location, transactionName);

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-view', 'performance-suspect-spans-view']}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={defined(project) ? [project.slug] : []}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <StyledPageContent>
            <NoProjectMessage organization={organization}>
              <SpanDetailsContent
                location={location}
                organization={organization}
                eventView={eventView}
                projectId={projectId}
                transactionName={transactionName}
                spanSlug={spanSlug}
              />
            </NoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
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

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
