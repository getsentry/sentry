import React from 'react';
import styled from '@emotion/styled';

import {RouteComponentProps} from 'react-router/lib/Router';
import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {t} from 'app/locale';

import Button from 'app/components/button';

enum DownloadStatus {
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

  renderExpired(): React.ReactNode {
    return (
      <React.Fragment>
        <h3>{t('Sorry!')}</h3>
        <p>
          {t('It seems this link has expired, and your download is no longer available.')}
        </p>
        <p>
          {t(
            'Feel free to start a new export to get the latest and greatest of your Sentry data.'
          )}
        </p>
      </React.Fragment>
    );
  }

  renderEarly(): React.ReactNode {
    return (
      <React.Fragment>
        <h3>{t("You're Early!")}</h3>
        <p>{t("We're still preparing your download, so check back in a bit!")}</p>
        <p>{t("You can close this page, we'll email you when were ready")}</p>
      </React.Fragment>
    );
  }

  renderValid(): React.ReactNode {
    const {download} = this.state;
    const {orgId, dataExportId} = this.props.params;
    if (!download.dateExpired) {
      return null;
    }
    const d = new Date(download.dateExpired);
    return (
      <React.Fragment>
        <h3>{t('Finally!')}</h3>
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
        <p>
          <b>{`${d.toLocaleDateString()}, ${d.toLocaleTimeString()}`}</b>
        </p>
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
      <PageContent>
        <div className="pattern-bg" />
        <ContentContainer>{this.renderContent()}</ContentContainer>
      </PageContent>
    );
  }
}

const ContentContainer = styled('div')`
  text-align: center;
  margin: ${space(4)} auto;
  width: 350px;
  padding: ${space(4)};
  background: ${p => p.theme.whiteDark};
  border-radius: ${p => p.theme.borderRadius};
  border: 2px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  p {
    margin: ${space(1.5)};
  }
`;

export default DataDownload;
