import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import Button from 'app/components/button';
import {ExportQueryType} from 'app/components/dataExport';
import DateTime from 'app/components/dateTime';
import AsyncView from 'app/views/asyncView';
import Layout from 'app/views/auth/layout';
import space from 'app/styles/space';
import {t} from 'app/locale';

export enum DownloadStatus {
  Early = 'EARLY',
  Valid = 'VALID',
  Expired = 'EXPIRED',
}

type RouteParams = {
  orgId: string;
  dataExportId: string;
};

type Download = {
  id: number;
  user: {
    id: number;
    email: string;
    username: string;
  };
  dateCreated: string;
  dateFinished?: string;
  dateExpired?: string;
  query: {
    type: ExportQueryType;
    info: object;
  };
  status: DownloadStatus;
};

type Props = {} & RouteComponentProps<RouteParams, {}>;

type State = {
  download: Download;
  errors: {
    download: {
      status: number;
      statusText: string;
      responseJSON: {
        detail: string;
      };
    };
  };
} & AsyncView['state'];

class DataDownload extends AsyncView<Props, State> {
  getTitle(): string {
    return t('Download Center');
  }

  getEndpoints(): [string, string][] {
    const {orgId, dataExportId} = this.props.params;
    return [['download', `/organizations/${orgId}/data-export/${dataExportId}/`]];
  }

  getActionLink(queryType): string {
    const {orgId} = this.props.params;
    switch (queryType) {
      case ExportQueryType.IssuesByTag:
        return `/organizations/${orgId}/issues/`;
      case ExportQueryType.Discover:
        return `/organizations/${orgId}/discover/queries/`;
      default:
        return '/';
    }
  }

  renderDate(date: string | undefined): React.ReactNode {
    if (!date) {
      return null;
    }
    const d = new Date(date);
    return (
      <strong>
        <DateTime date={d} />
      </strong>
    );
  }

  renderEarly(): React.ReactNode {
    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
  renderExpired(): React.ReactNode {
    const {query} = this.state.download;
    const actionLink = this.getActionLink(query.type);
    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
  renderValid(): React.ReactNode {
    const {
      download: {dateExpired},
    } = this.state;
    const {orgId, dataExportId} = this.props.params;
    return (
      <React.Fragment>
        <Header>
          <h3>{t('All done.')}</h3>
        </Header>
        <Body>
          <p>{t("See, that wasn't so bad. Your data is all ready for download.")}</p>
          <Button
            priority="primary"
            icon="icon-download"
            href={`/api/0/organizations/${orgId}/data-export/${dataExportId}/?download=true`}
          >
            {t('Download CSV')}
          </Button>
          <p>
            {t("That link won't last forever — it expires:")}
            <br />
            {this.renderDate(dateExpired)}
          </p>
        </Body>
      </React.Fragment>
    );
  }
  renderError(): React.ReactNode {
    const {
      errors: {download: err},
    } = this.state;
    return (
      <Layout>
        <main>
          <Header>
            <h3>
              {err.status} - {err.statusText}
            </h3>
          </Header>
          <Body>
            <p>{err.responseJSON.detail}</p>
          </Body>
        </main>
      </Layout>
    );
  }

  renderContent(): React.ReactNode {
    const {download} = this.state;
    switch (download.status) {
      case DownloadStatus.Early:
        return this.renderEarly();
      case DownloadStatus.Expired:
        return this.renderExpired();
      default:
        return this.renderValid();
    }
  }

  renderBody() {
    return (
      <Layout>
        <main>{this.renderContent()}</main>
      </Layout>
    );
  }
}

const Header = styled('header')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
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

const DownloadButton = styled(Button)`
  margin-bottom: ${space(1.5)};
`;

export default DataDownload;
