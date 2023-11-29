import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {ScreenLoadSampleContainer} from 'sentry/views/starfish/views/screens/screenLoadSpans/samples/samplesContainer';

type Props = {
  groupId: string;
  transactionName: string;
  onClose?: () => void;
  spanDescription?: string;
  transactionMethod?: string;
  transactionRoute?: string;
};

export function ScreenLoadSpanSamples({
  groupId,
  transactionName,
  transactionMethod,
  spanDescription,
  onClose,
  transactionRoute = '/performance/summary/',
}: Props) {
  const router = useRouter();

  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  // A a transaction name is required to show the panel, but a transaction
  // method is not
  const detailKey = transactionName
    ? [groupId, transactionName, transactionMethod].filter(Boolean).join(':')
    : undefined;

  const organization = useOrganization();
  const {query} = useLocation();
  const {projects} = useProjects();

  const project = useMemo(
    () => projects.find(p => p.id === String(query.project)),
    [projects, query.project]
  );

  const onOpenDetailPanel = useCallback(() => {
    if (query.transaction) {
      trackAnalytics('starfish.panel.open', {organization});
    }
  }, [organization, query.transaction]);

  const label =
    transactionMethod && !transactionName.startsWith(transactionMethod)
      ? `${transactionMethod} ${transactionName}`
      : transactionName;

  const link = normalizeUrl(
    `/organizations/${organization.slug}${transactionRoute}?${qs.stringify({
      project: query.project,
      transaction: transactionName,
    })}`
  );

  function defaultOnClose() {
    router.replace({
      pathname: router.location.pathname,
      query: omit(router.location.query, 'transaction', 'transactionMethod'),
    });
  }

  return (
    <PageErrorProvider>
      <DetailPanel
        detailKey={detailKey}
        onClose={() => {
          onClose ? onClose() : defaultOnClose();
        }}
        onOpen={onOpenDetailPanel}
      >
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
            {spanDescription && <SpanDescription>{spanDescription}</SpanDescription>}
            <Title>
              <Link to={link}>{label}</Link>
            </Title>
          </TitleContainer>
        </HeaderContainer>
        <PageErrorAlert />
        <ChartsContainer>
          <ChartsContainerItem key="release1">
            <ScreenLoadSampleContainer
              groupId={groupId}
              transactionName={transactionName}
              transactionMethod={transactionMethod}
              release={primaryRelease}
              sectionTitle={t('Release 1')}
            />
          </ChartsContainerItem>
          <ChartsContainerItem key="release2">
            <ScreenLoadSampleContainer
              groupId={groupId}
              transactionName={transactionName}
              transactionMethod={transactionMethod}
              release={secondaryRelease}
              sectionTitle={t('Release 2')}
            />
          </ChartsContainerItem>
        </ChartsContainer>
      </DetailPanel>
    </PageErrorProvider>
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

const SpanDescription = styled('div')`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 35vw;
`;

const ChartsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
  align-items: top;
`;

const ChartsContainerItem = styled('div')`
  flex: 1;
`;
