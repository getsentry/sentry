import 'prism-sentry/index.css';

import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getDynamicText from 'sentry/utils/getDynamicText';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

import FirstEventFooter from './components/firstEventFooter';
import FullIntroduction from './components/fullIntroduction';
import {StepProps} from './types';

type Props = StepProps & {
  api: Client;
  organization: Organization;
} & AsyncComponent['props'];

type State = {
  keyList: Array<ProjectKey> | null;
} & AsyncComponent['state'];

class OtherSetup extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      keyList: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    return [['keyList', `/projects/${organization.slug}/${project?.slug}/keys/`]];
  }

  handleFullDocsClick = () => {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('growth.onboarding_view_full_docs', {organization});
  };

  render() {
    const {organization, project} = this.props;
    const {keyList} = this.state;

    const currentPlatform = 'other';

    const blurb = (
      <Fragment>
        <p>
          {tct(`Prepare the SDK for your language following this [docsLink:guide].`, {
            docsLink: <ExternalLink href="https://develop.sentry.dev/sdk/overview/" />,
          })}
        </p>

        <p>
          {t('Once your SDK is set up, use the following DSN and send your first event!')}
        </p>

        <p>{tct('Here is the DSN: [DSN]', {DSN: <b> {keyList?.[0].dsn.public}</b>})}</p>
      </Fragment>
    );

    const docs = (
      <DocsWrapper>
        {blurb}
        {project && (
          <FirstEventFooter
            project={project}
            organization={organization}
            docsLink="https://develop.sentry.dev/sdk"
            docsOnClick={this.handleFullDocsClick}
          />
        )}
      </DocsWrapper>
    );

    const testOnlyAlert = (
      <Alert type="warning">
        Platform documentation is not rendered in for tests in CI
      </Alert>
    );

    return (
      <Fragment>
        <FullIntroduction currentPlatform={currentPlatform} />
        {getDynamicText({
          value: docs,
          fixed: testOnlyAlert,
        })}
      </Fragment>
    );
  }
}

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

export default withOrganization(withApi(OtherSetup));
