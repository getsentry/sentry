import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import {RouteComponentProps} from 'react-router/lib/Router';
import AsyncView from 'app/views/asyncView';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';

import Button from 'app/components/button';
import Sidebar from 'app/components/sidebar';

type RouteParams = {
  orgId: string;
  dataTag: string;
};

type DataAsset = {
  url: string;
  expiration: string;
};

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  asset: DataAsset;
} & AsyncView['state'];

class DataDownload extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      asset: {
        url: '',
        expiration: '',
      },
    };
  }

  getTitle() {
    return t('Download Center');
  }

  getEndpoints(): [string, string][] {
    const {orgId, dataTag} = this.props.params;
    return [['asset', `/organizations/${orgId}/data-export/${dataTag}/`]];
  }

  handleDownload() {
    const {asset} = this.state;
    // eslint-disable-next-line
    alert(`Beginning download at ${asset && asset.url}`);
  }

  renderBody() {
    const {asset} = this.state;
    const d = new Date(asset.expiration);
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
            <b>{d.toLocaleDateString()}</b>
          </p>
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

export default withOrganization(withApi(DataDownload));
