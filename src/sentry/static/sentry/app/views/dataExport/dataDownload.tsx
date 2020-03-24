import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import Button from 'app/components/button';
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
    type: number;
    info: object;
  };
  status: DownloadStatus;
};

type Props = {} & RouteComponentProps<RouteParams, {}>;

type State = {
  download: Download;
} & AsyncView['state'];

class DataDownload extends AsyncView<Props, State> {
  getTitle(): string {
    return t('Download Center');
  }

  getEndpoints(): [string, string][] {
    const {orgId, dataExportId} = this.props.params;
    return [['download', `/organizations/${orgId}/data-export/${dataExportId}/`]];
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

  renderExpired(): React.ReactNode {
    return (
      <React.Fragment>
        <Header>
          <h3>{t('Sorry!')}</h3>
        </Header>
        <Body>
          <p>
            {t(
              'It seems this link has expired, and your download is no longer available.'
            )}
          </p>
          <p>
            {t(
              'Feel free to start a new export to get the latest and greatest of your Sentry data.'
            )}
          </p>
        </Body>
      </React.Fragment>
    );
  }

  renderEarly(): React.ReactNode {
    return (
      <React.Fragment>
        <Header>
          <h3>{t("You're Early!")}</h3>
        </Header>
        <Body>
          <p>{t("We're still preparing your download, so check back in a bit!")}</p>
          <p>{t("You can close this page, we'll email you when were ready")}</p>
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
          <h3>{t('Finally!')}</h3>
        </Header>
        <Body>
          <p>
            {t(
              'We prepared your data for download, you can access it with the link below.'
            )}
          </p>
          <Button
            priority="primary"
            icon="icon-download"
            size="large"
            borderless
            href={`/api/0/organizations/${orgId}/data-export/${dataExportId}/?download=true`}
          >
            {t('Download CSV')}
          </Button>
          <p>{t('Keep in mind, this link will no longer work after:')}</p>
          <p>{this.renderDate(dateExpired)}</p>
        </Body>
      </React.Fragment>
    );
  }

  renderContent(): React.ReactNode {
    const {download} = this.state;
    switch (download.status) {
      case DownloadStatus.Expired:
        return this.renderExpired();
      case DownloadStatus.Early:
        return this.renderEarly();
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
  padding: ${space(4)} 40px;
  p {
    margin: ${space(1.5)} 0;
  }
`;

export default DataDownload;
