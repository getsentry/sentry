import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExportQueryType} from 'sentry/components/dataExport';
import {DateTime} from 'sentry/components/dateTime';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {AuthLayoutWrapper as Layout} from 'sentry/views/auth/layout';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

export enum DownloadStatus {
  EARLY = 'EARLY',
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
}

interface ExploreQueryInfo {
  dataset: TraceItemDataset;
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  equations?: string[];
  start?: string;
  statsPeriod?: string;
}

type BaseDownload = {
  checksum: string;
  dateCreated: string;
  id: number;
  status: DownloadStatus;
  user: {
    email: string;
    id: number;
    username: string;
  };
  dateExpired?: string;
  dateFinished?: string;
};

type ExploreDownload = BaseDownload & {
  query: {
    info: ExploreQueryInfo;
    type: ExportQueryType.EXPLORE;
  };
};

type OtherDownload = BaseDownload & {
  query: {
    info: Record<PropertyKey, unknown>;
    type: Exclude<ExportQueryType, ExportQueryType.EXPLORE>;
  };
};

type Download = ExploreDownload | OtherDownload;

function DataDownload() {
  const {dataExportId, orgId: orgSlug} = useParams<{
    dataExportId: string;
    orgId: string;
  }>();

  const {
    data: download,
    isPending,
    isError,
    error,
  } = useApiQuery<Download>([`/organizations/${orgSlug}/data-export/${dataExportId}/`], {
    staleTime: 0,
  });

  const navigate = useNavigate();

  if (isError) {
    const errDetail = error?.responseJSON?.detail;
    return (
      <Layout>
        <main>
          <Header>
            <h3>
              {error.status} - {error.statusText}
            </h3>
          </Header>
          {errDetail && (
            <Body>
              <p>{errDetail as string}</p>
            </Body>
          )}
        </main>
      </Layout>
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const getActionLink = (
    queryType: ExportQueryType,
    traceItemDataset?: TraceItemDataset
  ): string => {
    switch (queryType) {
      case ExportQueryType.ISSUES_BY_TAG:
        return `/organizations/${orgSlug}/issues/`;
      case ExportQueryType.DISCOVER:
        return `/organizations/${orgSlug}/discover/queries/`;
      case ExportQueryType.EXPLORE:
        if (traceItemDataset === TraceItemDataset.LOGS) {
          return `/organizations/${orgSlug}/explore/logs/`;
        }
        return `/organizations/${orgSlug}/explore/traces/`;
      default:
        return '/';
    }
  };

  const renderDate = (date: string | undefined): React.ReactNode => {
    if (!date) {
      return null;
    }
    const d = new Date(date);
    return (
      <strong>
        <DateTime date={d} />
      </strong>
    );
  };

  const renderEarly = (): React.ReactNode => {
    return (
      <Fragment>
        <Header>
          <h3>
            {t('What are')}
            <i>{t(' you ')}</i>
            {t('doing here?')}
          </h3>
        </Header>
        <Body>
          <p>
            {t(
              "Not that its any of our business, but were you invited to this page? It's just that we don't exactly remember emailing you about it."
            )}
          </p>
          <p>{t("Close this window and we'll email you when your download is ready.")}</p>
        </Body>
      </Fragment>
    );
  };

  const renderExpired = (): React.ReactNode => {
    const {query} = download;
    let actionLink: string;

    if (query.type === ExportQueryType.EXPLORE) {
      const traceItemDataset = query.info.dataset;
      actionLink = getActionLink(query.type, traceItemDataset);
    } else {
      actionLink = getActionLink(query.type);
    }
    return (
      <Fragment>
        <Header>
          <h3>{t('This is awkward.')}</h3>
        </Header>
        <Body>
          <p>
            {t(
              "That link expired, so your download doesn't live here anymore. Just picked up one day and left town."
            )}
          </p>
          <p>
            {t(
              'Make a new one with your latest data. Your old download will never see it coming.'
            )}
          </p>
          <DownloadButton href={actionLink} priority="primary">
            {t('Start a New Download')}
          </DownloadButton>
        </Body>
      </Fragment>
    );
  };

  const openInDiscover = () => {
    const {
      query: {info},
    } = download;

    const to = {
      pathname: `/organizations/${orgSlug}/discover/results/`,
      query: info,
    };

    navigate(normalizeUrl(to));
  };

  const openInExplore = () => {
    const {query} = download;

    if (query.type !== ExportQueryType.EXPLORE) {
      return;
    }

    const {info} = query;
    const traceItemDataset = info.dataset;

    if (traceItemDataset === TraceItemDataset.LOGS) {
      const url = getLogsUrl({
        organization: orgSlug,
        selection: {
          datetime: {
            end: info.end ?? null,
            start: info.start ?? null,
            utc: null,
            period: info.statsPeriod ?? null,
          },
          environments: info.environment ?? [],
          projects: info.project,
        },
        query: info.query,
        field: info.field,
      });
      navigate(url);
      return;
    }

    // We can't pass in explore queries the same way we pass in discover queries to the url.
    // Explore queries need to have field or aggregateField depending on the mode it's in.
    // We're structuring the info object to include the correct formatting.

    const equations = Array.isArray(info.equations) ? info.equations : [];
    const aggregates = Array.isArray(info.field)
      ? info.field.filter((field: string) => isAggregateField(field))
      : [];

    const fields = Array.isArray(info.field)
      ? info.field.filter((field: string) => !isAggregateField(field))
      : [];

    const mode = aggregates.length + equations.length > 0 ? Mode.AGGREGATE : Mode.SAMPLES;

    const groupBy = fields.map(field => ({groupBy: field}));
    const aggregateFields = aggregates.map(aggregate => ({yAxes: [aggregate]}));
    const equationFields = equations.map(equation => ({yAxes: [equation]}));

    const aggregateInfo = {
      mode,
      aggregateField: [...groupBy, ...aggregateFields, ...equationFields],
      field: [],
    };

    const samplesInfo = {
      mode,
      aggregateField: [],
      field: fields,
    };

    const to = {
      pathname: `/organizations/${orgSlug}/explore/traces/`,
      query: {...info, ...(mode === Mode.AGGREGATE ? aggregateInfo : samplesInfo)},
    };

    navigate(normalizeUrl(to));
  };

  const renderOpenInButton = () => {
    const {
      query = {
        type: ExportQueryType.ISSUES_BY_TAG,
        info: {},
      },
    } = download;

    // default to IssuesByTag because we don't want to
    // display this unless we're sure its a discover query
    const {type = ExportQueryType.ISSUES_BY_TAG} = query;

    return type === 'Discover' || type === 'Explore' ? (
      <Fragment>
        <p>{t('Need to make changes?')}</p>
        <Button
          priority="primary"
          onClick={() => (type === 'Discover' ? openInDiscover() : openInExplore())}
        >
          {type === 'Discover' ? t('Open in Discover') : t('Open in Explore')}
        </Button>
        <br />
      </Fragment>
    ) : null;
  };

  const renderValid = (): React.ReactNode => {
    const {dateExpired, checksum} = download;

    return (
      <Fragment>
        <Header>
          <h3>{t('All done.')}</h3>
        </Header>
        <Body>
          <p>{t("See, that wasn't so bad. Your data is all ready for download.")}</p>
          <LinkButton
            priority="primary"
            icon={<IconDownload />}
            href={`/api/0/organizations/${orgSlug}/data-export/${dataExportId}/?download=true`}
          >
            {t('Download CSV')}
          </LinkButton>
          <p>
            {t("That link won't last forever — it expires:")}
            <br />
            {renderDate(dateExpired)}
          </p>
          {renderOpenInButton()}
          <p>
            <small>
              <strong>SHA1:{checksum}</strong>
            </small>
            <br />
            {tct('Need help verifying? [link].', {
              link: (
                <a
                  href="https://docs.sentry.io/product/discover-queries/query-builder/#filter-by-table-columns"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('Check out our docs')}
                </a>
              ),
            })}
          </p>
        </Body>
      </Fragment>
    );
  };

  const renderContent = () => {
    switch (download.status) {
      case DownloadStatus.EARLY:
        return renderEarly();
      case DownloadStatus.EXPIRED:
        return renderExpired();
      default:
        return renderValid();
    }
  };

  return (
    <SentryDocumentTitle title={t('Download Center')}>
      <Layout>
        <main>{renderContent()}</main>
      </Layout>
    </SentryDocumentTitle>
  );
}

const Header = styled('header')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(3)} 40px 0;
  h3 {
    font-size: 24px;
    margin: 0 0 ${space(3)} 0;
  }
`;

const Body = styled('div')`
  padding: ${space(2)} 40px;
  max-width: 500px;
  p {
    margin: ${space(1.5)} 0;
  }
`;

const DownloadButton = styled(LinkButton)`
  margin-bottom: ${space(1.5)};
`;

export default DataDownload;
