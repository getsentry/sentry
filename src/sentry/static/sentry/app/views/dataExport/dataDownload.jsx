import React from 'react';
import styled from '@emotion/styled';

import AsyncView from 'app/views/asyncView';
import {PageContent, PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';

import PageHeading from 'app/components/pageHeading';
import Button from 'app/components/button';

class DataDownload extends AsyncView {
  renderBody() {
    return (
      <PageContent>
        <PageHeader>
          <PageHeading>{t('Download')}</PageHeading>
        </PageHeader>
        <DownloadButton priority="primary" icon="icon-download" size="large" borderless>
          {t('Download CSV')}
        </DownloadButton>
      </PageContent>
    );
  }
}

const DownloadButton = styled(Button)``;
export default DataDownload;
