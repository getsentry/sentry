import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DocumentIntegration} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import {documentIntegrations} from './constants';

type Tab = AbstractIntegrationDetailedView['state']['tab'];

class SentryAppDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  AbstractIntegrationDetailedView['state']
> {
  tabs: Tab[] = ['overview'];

  get integrationType() {
    return 'document' as const;
  }

  get integration(): DocumentIntegration {
    const {integrationSlug} = this.props.params;
    const documentIntegration = documentIntegrations[integrationSlug];
    if (!documentIntegration) {
      throw new Error(`No document integration of slug ${integrationSlug} exists`);
    }
    return documentIntegration;
  }

  get description() {
    return this.integration.description;
  }

  get author() {
    return this.integration.author;
  }

  get resourceLinks() {
    return this.integration.resourceLinks;
  }

  get installationStatus() {
    return null;
  }

  get integrationName() {
    return this.integration.name;
  }

  get featureData() {
    return this.integration.features;
  }

  componentDidMount() {
    super.componentDidMount();
    this.trackIntegrationAnalytics('integrations.integration_viewed', {
      integration_tab: 'overview',
    });
  }

  trackClick = () => {
    this.trackIntegrationAnalytics('integrations.installation_start');
  };

  renderTopButton() {
    return (
      <ExternalLink href={this.integration.docUrl} onClick={this.trackClick}>
        <LearnMoreButton
          size="small"
          priority="primary"
          style={{marginLeft: space(1)}}
          data-test-id="learn-more"
          icon={<StyledIconOpen size="xs" />}
        >
          {t('Learn More')}
        </LearnMoreButton>
      </ExternalLink>
    );
  }

  // No configurations.
  renderConfigurations() {
    return null;
  }
}

const LearnMoreButton = styled(Button)`
  margin-left: ${space(1)};
`;

const StyledIconOpen = styled(IconOpen)`
  transition: 0.1s linear color;
  margin: 0 ${space(0.5)};
  position: relative;
  top: 1px;
`;

export default withOrganization(SentryAppDetailedView);
