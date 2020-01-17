import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Config, Organization} from 'app/types';
import {RouteComponentProps} from 'react-router/lib/Router';
import AsyncView from 'app/views/asyncView';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withConfig from 'app/utils/withConfig';
import withLatestContext from 'app/utils/withLatestContext';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';

import Button from 'app/components/button';
import Sidebar from 'app/components/sidebar';

type RouteParams = {
  orgId: string;
  dataId: string;
};

type Payload = {
  storage_url?: string;
  expired_at?: string;
  status?: 'EXPIRED' | 'INVALID' | 'VALID' | 'EARLY';
};

type Props = {
  api: Client;
  organization: Organization;
  config: Config;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  payload: Payload;
} & AsyncView['state'];

class DataDownload extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      payload: {
        storage_url: '',
        expired_at: '',
      },
    };
  }

  getTitle(): string {
    return t('Download Center');
  }

  getEndpoints(): [string, string][] {
    const {orgId, dataId} = this.props.params;
    return [['payload', `/organizations/${orgId}/data-export/${dataId}/`]];
  }

  handleDownload(): void {
    // TODO(Leander): Implement direct download from Google Cloud Storage
  }

  isValidDate(potentialDate): boolean {
    return potentialDate instanceof Date && !isNaN(potentialDate.getTime());
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

  renderInvalid(): React.ReactNode {
    return (
      <React.Fragment>
        <h3>{t('Not Found')}</h3>
        <p>{t("We couldn't find a file associated with this link.")}</p>
        <p>{t('Please double check it and try again!')}</p>
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
    const {payload} = this.state;
    const d = new Date(payload.expired_at || '');
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
          onClick={() => this.handleDownload()}
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
    const {payload} = this.state;
    switch (payload.status) {
      case 'EXPIRED':
        return this.renderExpired();
      case 'INVALID':
        return this.renderInvalid();
      case 'EARLY':
        return this.renderEarly();
      case 'VALID':
      default:
        return this.renderValid();
    }
  }

  renderBody() {
    return (
      <PageContent>
        <Sidebar />
        <div className="pattern-bg" />
        <ContentContainer>{this.renderContent()}</ContentContainer>
      </PageContent>
    );
  }
}

const ContentContainer = styled('div')`
  text-align: center;
  margin: 30px auto;
  width: 350px;
  padding: 30px;
  background: ${p => p.theme.whiteDark};
  border-radius: ${p => p.theme.borderRadius};
  border: 2px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  p {
    margin: 15px;
  }
`;

export default withLatestContext(withConfig(withApi(withOrganization(DataDownload))));
