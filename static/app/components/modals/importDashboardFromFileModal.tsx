import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import type {Location} from 'history';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {
  assignDefaultLayout,
  getInitialColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import {Wrapper} from 'sentry/views/discover/table/quickContext/styles';

export interface ImportDashboardFromFileModalProps {
  api: Client;
  location: Location;
  organization: Organization;
}

// Internal feature - no specs written.
function ImportDashboardFromFileModal({
  Header,
  Body,
  Footer,
  organization,
  api,
  location,
}: ModalRenderProps & ImportDashboardFromFileModalProps) {
  const [dashboardData, setDashboardData] = useState('');
  const [validated, setValidated] = useState(false);

  function validateFile(fileToUpload: File) {
    if (!fileToUpload || !(fileToUpload.type === 'application/json')) {
      addErrorMessage('You must upload a JSON file');
      setValidated(false);
      setDashboardData('');
      return false;
    }

    setValidated(true);
    return true;
  }

  const handleFileChange = (e: any) => {
    const fileToUpload = e.target.files[0];
    if (validateFile(fileToUpload)) {
      const fileReader = new FileReader();
      fileReader.readAsText(fileToUpload, 'UTF-8');
      fileReader.onload = event => {
        const target = event.target;
        if (target && typeof target.result === 'string') {
          const parsed = JSON.parse(target.result);
          const formatted = JSON.stringify(parsed, null, '\t');
          setDashboardData(formatted);
        }
      };
    }
  };

  const handleUploadClick = async () => {
    const dashboard = JSON.parse(dashboardData);

    try {
      const newDashboard = await createDashboard(
        api,
        organization.slug,
        {
          ...dashboard,
          widgets: assignDefaultLayout(dashboard.widgets, getInitialColumnDepths()),
        },
        true
      );

      addSuccessMessage(`${dashboard.title} dashboard template successfully added`);
      loadDashboard(newDashboard.id);
    } catch (error) {
      addErrorMessage('Could not upload dashboard, JSON may be invalid');
    }
  };

  const loadDashboard = (dashboardId: string) => {
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/${dashboardId}/`,
        query: location.query,
      })
    );
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Import Dashboard from JSON File')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <input type="file" onChange={handleFileChange} />
        </Wrapper>
        <Wrapper>
          <Button
            onClick={handleUploadClick}
            disabled={!validated}
            priority="primary"
            icon={<IconUpload />}
          >
            {t('Import')}
          </Button>
        </Wrapper>
      </Body>
      {validated && (
        <Fragment>
          <Footer />
          <Wrapper>
            <h4>{t('Preview')}</h4>
          </Wrapper>
          <CodeSnippet language="json">{dashboardData}</CodeSnippet>
        </Fragment>
      )}
    </Fragment>
  );
}

export default ImportDashboardFromFileModal;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
