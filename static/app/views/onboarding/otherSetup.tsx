import 'prism-sentry/index.css';

import * as React from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import getDynamicText from 'app/utils/getDynamicText';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {ProjectKey} from 'app/views/settings/project/projectKeys/types';

import FirstEventFooter from './components/firstEventFooter';
import SetupIntroduction from './components/setupIntroduction';
import {StepProps} from './types';

type AnalyticsOpts = {
  organization: Organization;
  project: Project | null;
  platform: PlatformKey | null;
};

const recordAnalyticsDocsClicked = ({organization, project, platform}: AnalyticsOpts) =>
  analytics('onboarding_v2.full_docs_clicked', {
    org_id: organization.id,
    project: project?.slug,
    platform,
  });

type Props = StepProps & {
  api: Client;
  organization: Organization;
} & AsyncComponent['props'];

type State = {
  platformDocs: {html: string; link: string} | null;
  loadedPlatform: PlatformKey | null;
  hasError: boolean;
  keyList: Array<ProjectKey> | null;
} & AsyncComponent['state'];

class OtherSetup extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      platformDocs: null,
      loadedPlatform: null,
      hasError: false,
      keyList: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    return [['keyList', `/projects/${organization.slug}/${project?.slug}/keys/`]];
  }

  handleFullDocsClick = () => {
    const {organization, project, platform} = this.props;
    recordAnalyticsDocsClicked({organization, project, platform});
  };

  render() {
    const {organization, project, platform} = this.props;
    const {loadedPlatform, hasError, keyList} = this.state;

    const currentPlatform = loadedPlatform ?? platform ?? 'other';

    const introduction = (
      <React.Fragment>
        <SetupIntroduction
          stepHeaderText={t(
            'Prepare the %s SDK',
            platforms.find(p => p.id === currentPlatform)?.name ?? ''
          )}
          platform={currentPlatform}
        />
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {tct(
            "Don't have a relationship with your terminal? [link:Invite your team instead].",
            {
              link: (
                <Button
                  priority="link"
                  data-test-id="onboarding-getting-started-invite-members"
                  onClick={openInviteMembersModal}
                />
              ),
            }
          )}
        </motion.p>
      </React.Fragment>
    );

    const blurb = (
      <React.Fragment>
        <p>
          {tct(`Prepare the SDK for your language following this [docsLink:guide].`, {
            docsLink: <ExternalLink href="https://develop.sentry.dev/sdk/overview/" />,
            platform: platforms.find(p => p.id === loadedPlatform)?.name,
          })}
        </p>

        <p>
          {t('Once your SDK is set up, use the following DSN and send your first event!')}
        </p>

        <p>
          {'Here is the DSN : '}
          <b> {keyList?.[0].dsn.public}</b>
        </p>
      </React.Fragment>
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

    const loadingError = (
      <LoadingError
        message={t('Failed to load documentation for the %s platform.', platform)}
        onRetry={this.fetchData}
      />
    );

    const testOnlyAlert = (
      <Alert type="warning">
        Platform documentation is not rendered in for tests in CI
      </Alert>
    );

    return (
      <React.Fragment>
        {introduction}
        {getDynamicText({
          value: !hasError ? docs : loadingError,
          fixed: testOnlyAlert,
        })}
      </React.Fragment>
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
