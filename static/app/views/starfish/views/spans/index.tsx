import React from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';

import SpansView from './spansView';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

export default function Spans(props: Props) {
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Spans')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <SpansView location={props.location} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
