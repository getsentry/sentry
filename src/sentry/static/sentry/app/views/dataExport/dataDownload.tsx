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

type DataAsset = {
  storage_url: string;
  expired_at: string;
};

type Props = {
  api: Client;
  organization: Organization;
  config: Config;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  asset: DataAsset;
} & AsyncView['state'];

class DataDownload extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      asset: {
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
    return [['asset', `/organizations/${orgId}/data-export/${dataId}/`]];
  }

  handleDownload(): void {
    const {asset} = this.state;
    // eslint-disable-next-line
    alert(`Beginning download at ${asset && asset.storage_url}`);
  }

  pingRequest(): void {
    const {config, organization, params} = this.props;
    const endpoint = `/organizations/${params.orgId}/data-export/${params.dataId}/`;
    const {id: user_id} = config.user;
    const {slug: org_id} = organization;
    this.api.request(endpoint, {
      method: 'POST',
      data: {
        user_id,
        org_id,
      },
      success(response) {
        // eslint-disable-next-line
        alert(response);
      },
    });
  }

  renderBody() {
    const {asset} = this.state;
    const d = new Date(asset.expired_at);
    return (
      <PageContent>
        <Sidebar />
        <div className="pattern-bg" />
        <ContentContainer>
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
        </ContentContainer>
        <ContentContainer>
          <Button
            priority="primary"
            icon="icon-sentry"
            size="large"
            borderless
            onClick={() => this.pingRequest()}
          >
            {t('Trigger Task')}
          </Button>
        </ContentContainer>
      </PageContent>
    );
  }
}

const ContentContainer = styled('div')`
  text-align: center;
  margin: 30px auto;
  width: 300px;
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
