import React from 'react';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import * as Layout from 'app/components/layouts/thirds';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import Breadcrumb from 'app/views/performance/breadcrumb';

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
  traceSlug: string;
};

class TraceDetailsContent extends React.Component<Props> {
  render() {
    const {organization, location, traceSlug} = this.props;

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              traceSlug={traceSlug}
            />
            <Layout.Title data-test-id="trace-header">
              {t('Trace Id: %s', traceSlug)}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{null}</Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

export default TraceDetailsContent;
