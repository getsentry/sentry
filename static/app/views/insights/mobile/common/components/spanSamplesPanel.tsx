import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {SpanSamplesContainer} from 'sentry/views/insights/mobile/common/components/spanSamplesPanelContainer';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {type ModuleName, SpanMetricsField} from 'sentry/views/insights/types';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

type Props = {
  groupId: string;
  moduleName: ModuleName;
  onClose?: () => void;
  transactionRoute?: string;
};

const PRIMARY_SPAN_QUERY_KEY = 'primarySpanSearchQuery';
const SECONDARY_SPAN_QUERY_KEY = 'secondarySpanSearchQuery';

export function SpanSamplesPanel({groupId, moduleName, transactionRoute}: Props) {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();

  const {
    [SpanMetricsField.APP_START_TYPE]: appStartType,
    [SpanMetricsField.DEVICE_CLASS]: deviceClass,
    transaction: transactionName,
    transactionMethod,
    spanOp,
    spanDescription,
  } = useLocationQuery({
    fields: {
      [SpanMetricsField.APP_START_TYPE]: decodeScalar,
      [SpanMetricsField.DEVICE_CLASS]: decodeScalar,
      transaction: decodeScalar,
      transactionMethod: decodeScalar,
      spanOp: decodeScalar,
      spanDescription: decodeScalar,
    },
  });

  const additionalFilters = {
    ...(appStartType ? {[SpanMetricsField.APP_START_TYPE]: appStartType} : {}),
    ...(deviceClass ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass} : {}),
  };

  transactionRoute ??= getTransactionSummaryBaseUrl(organization.slug, view);

  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const {query} = useLocation();
  const {project} = useCrossPlatformProject();

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

  return (
    <PageAlertProvider>
      <DrawerHeader />

      <SampleDrawerBody>
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
        <PageAlert />
        <ChartsContainer>
          <ChartsContainerItem key="release1">
            <SpanSamplesContainer
              groupId={groupId}
              moduleName={moduleName}
              transactionName={transactionName}
              transactionMethod={transactionMethod}
              release={primaryRelease}
              sectionTitle={t('Release 1')}
              searchQueryKey={PRIMARY_SPAN_QUERY_KEY}
              spanOp={spanOp}
              additionalFilters={additionalFilters}
            />
          </ChartsContainerItem>
          <ChartsContainerItem key="release2">
            <SpanSamplesContainer
              groupId={groupId}
              moduleName={moduleName}
              transactionName={transactionName}
              transactionMethod={transactionMethod}
              release={secondaryRelease}
              sectionTitle={t('Release 2')}
              searchQueryKey={SECONDARY_SPAN_QUERY_KEY}
              spanOp={spanOp}
              additionalFilters={additionalFilters}
            />
          </ChartsContainerItem>
        </ChartsContainer>
      </SampleDrawerBody>
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
