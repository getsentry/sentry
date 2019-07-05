import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t} from 'app/locale';

import AsyncComponent from 'app/components/asyncComponent';
import HookStore from 'app/stores/hookStore';
import marked, {singleLineRenderer} from 'app/utils/marked';
import InlineSvg from 'app/components/inlineSvg';
import Tag from 'app/views/settings/components/tag';

const defaultFeatureGateComponents = {
  IntegrationFeatures: p =>
    p.children({
      disabled: false,
      disabledReason: null,
      ungatedFeatures: p.features,
      gatedFeatureGroups: [],
    }),
  FeatureList: p => (
    <ul>
      {p.features.map((f, i) => (
        <li key={i}>{f.description}</li>
      ))}
    </ul>
  ),
};

export default class SentryAppDetailsModal extends AsyncComponent {
  static propTypes = {
    sentryApp: SentryTypes.SentryApplication.isRequired,
    organization: SentryTypes.Organization.isRequired,
    onInstall: PropTypes.func.isRequired,
    isInstalled: PropTypes.bool.isRequired,
    closeModal: PropTypes.func.isRequired,
  };

  getEndpoints() {
    const {sentryApp} = this.props;
    return [['featureData', `/sentry-apps/${sentryApp.slug}/features/`]];
  }

  featureTags(features) {
    return features.map(feature => {
      const feat = feature.featureGate.replace(/integrations/g, '');
      return <StyledTag key={feat}>{feat.replace(/-/g, ' ')}</StyledTag>;
    });
  }

  renderBody() {
    const {sentryApp, closeModal, onInstall, isInstalled, organization} = this.props;
    const {featureData} = this.state;
    // Prepare the features list
    const features = (featureData || []).map(f => ({
      featureGate: f.featureGate,
      description: (
        <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
      ),
    }));

    const defaultHook = () => defaultFeatureGateComponents;
    const featureHook = HookStore.get('integrations:feature-gates')[0] || defaultHook;
    const {FeatureList, IntegrationFeatures} = featureHook();

    const overview = sentryApp.overview || '';
    const featureProps = {organization, features};

    return (
      <React.Fragment>
        <Flex align="center" mb={2}>
          <PluginIcon pluginId={sentryApp.slug} size={50} />

          <Flex pl={1} align="flex-start" direction="column" justify="center">
            <Name>{sentryApp.name}</Name>
            <Flex>{features.length && this.featureTags(features)}</Flex>
          </Flex>
        </Flex>

        <Description dangerouslySetInnerHTML={{__html: marked(overview)}} />
        <FeatureList {...featureProps} provider={{...sentryApp, key: sentryApp.slug}} />

        <Metadata>
          <Author flex={1}>{t('By %s', sentryApp.author)}</Author>
        </Metadata>

        <IntegrationFeatures {...featureProps}>
          {({disabled, disabledReason}) => (
            <div className="modal-footer">
              {disabled && <DisabledNotice reason={disabledReason} />}
              <Button size="small" onClick={closeModal}>
                {t('Cancel')}
              </Button>

              <Access organization={organization} access={['org:integrations']}>
                {({hasAccess}) =>
                  hasAccess && (
                    <Button
                      size="small"
                      priority="primary"
                      disabled={isInstalled || disabled}
                      onClick={onInstall}
                      style={{marginLeft: space(1)}}
                    >
                      {t('Install')}
                    </Button>
                  )
                }
              </Access>
            </div>
          )}
        </IntegrationFeatures>
      </React.Fragment>
    );
  }
}

const Name = styled(Box)`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: 1.5rem;
  line-height: 2.1rem;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled(Flex)`
  font-size: 0.9em;
  margin-bottom: ${space(2)};

  a {
    margin-left: ${space(1)};
  }
`;

const Author = styled(Box)`
  color: ${p => p.theme.gray2};
`;

const DisabledNotice = styled(({reason, ...p}) => (
  <Flex align="center" flex={1} {...p}>
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <Box ml={1}>{reason}</Box>
  </Flex>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;
