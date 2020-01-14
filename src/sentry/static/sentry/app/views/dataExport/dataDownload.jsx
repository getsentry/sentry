import React from 'react';
import styled from '@emotion/styled';

import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';

import Button from 'app/components/button';
import Sidebar from 'app/components/sidebar';

class DataDownload extends AsyncView {
  renderBody() {
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
          <DownloadButton priority="primary" icon="icon-download" size="large" borderless>
            {t('Download CSV')}
          </DownloadButton>
          <p>{t('Keep in mind, this link will expire at {{DATE_TIME}}.')}</p>
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

const DownloadButton = styled(Button)``;
export default DataDownload;
