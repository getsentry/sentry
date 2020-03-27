import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {DocumentIntegration} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

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

    return documentIntegrations[integrationSlug] || {};
  }

  get description() {
    return this.integration.description || '';
  }

  get author() {
    return this.integration.author || '';
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

  trackClick = () => {
    this.trackIntegrationEvent({
      eventKey: 'integrations.installation_start',
      eventName: 'Integrations: Installation Start',
    });
  };

  renderTopButton() {
    return (
      <a
        href={this.integration.docUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={this.trackClick}
      >
        <LearnMoreButton
          size="small"
          priority="primary"
          style={{marginLeft: space(1)}}
          data-test-id="learn-more"
        >
          {t('Learn More')}
        </LearnMoreButton>
      </a>
    );
  }

  //no configuraitons
  renderConfigurations() {
    return null;
  }
}

const LearnMoreButton = styled(Button)`
  margin-left: ${space(1)};
`;

export default withOrganization(SentryAppDetailedView);
