import styled from '@emotion/styled';

import DocIntegrationAvatar from 'sentry/components/avatar/docIntegrationAvatar';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DocIntegration} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';

type Tab = AbstractIntegrationDetailedView['state']['tab'];

type State = {
  doc: DocIntegration;
};

class DocIntegrationDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  tabs: Tab[] = ['overview'];

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {
      params: {integrationSlug},
    } = this.props;
    return [['doc', `/doc-integrations/${integrationSlug}/`]];
  }

  get integrationType() {
    return 'document' as const;
  }

  get integration(): DocIntegration {
    return this.state.doc;
  }

  get description() {
    return this.integration.description;
  }

  get author() {
    return this.integration.author;
  }

  get resourceLinks() {
    return this.integration.resources ?? [];
  }

  get installationStatus() {
    return null;
  }

  get integrationName() {
    return this.integration.name;
  }

  get featureData() {
    return this.integration.features ?? [];
  }

  get requiresAccess() {
    return false;
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
      <ExternalLink
        href={this.integration.url}
        onClick={this.trackClick}
        data-test-id="learn-more"
      >
        <LearnMoreButton
          size="sm"
          priority="primary"
          style={{marginLeft: space(1)}}
          icon={<StyledIconOpen />}
        >
          {t('Learn More')}
        </LearnMoreButton>
      </ExternalLink>
    );
  }

  renderIntegrationIcon() {
    return <DocIntegrationAvatar docIntegration={this.integration} size={50} />;
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

export default withOrganization(DocIntegrationDetailedView);
