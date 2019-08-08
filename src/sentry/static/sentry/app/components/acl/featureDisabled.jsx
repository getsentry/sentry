import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {selectText} from 'app/utils/selectText';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import space from 'app/styles/space';

const CONFIG_DOCS_URL = 'https://docs.sentry.io/server/config/';

const installText = (features, featureName) =>
  `# ${t('Enables the %s feature', featureName)}\n${features
    .map(f => `SENTRY_FEATURES['${f}'] = True`)
    .join('\n')}`;

/**
 * DisabledInfo renders a component informing that a feature has been disabled.
 *
 * By default this component will render a help button which toggles more
 * information about why the feature is disabled, showing the missing feature
 * flag and linking to documentation for managing sentry server feature flags.
 */
class FeatureDisabled extends React.Component {
  static propTypes = {
    /**
     * The feature flag keys that should be awed in the code example for
     * enabling the feature.
     */
    features: PropTypes.arrayOf(PropTypes.string).isRequired,
    /**
     * The English name of the feature. This is used in the comment that will
     * be outputted above the example line of code to enable the feature.
     */
    featureName: PropTypes.string.isRequired,
    /**
     * Render the disabled message within a warning Alert. A custom Alert
     * component may be provided.
     *
     * Attaches additional styles to the FeatureDisabled component to make it
     * look consistent within the Alert.
     */
    alert: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
    /**
     * Do not show the help toggle. The description will always be rendered.
     */
    hideHelpToggle: PropTypes.bool,
    /**
     * A custom message to display. Defaults to a generic disabled message.
     */
    message: PropTypes.string,
  };

  static defaultProps = {
    message: t('This feature is not enabled on your Sentry installation.'),
  };

  state = {
    showHelp: false,
  };

  toggleHelp = e => {
    e.preventDefault();
    this.setState(state => ({showHelp: !state.showHelp}));
  };

  render() {
    const {showHelp} = this.state;
    const {message, features, featureName, hideHelpToggle, alert} = this.props;
    const showDescription = hideHelpToggle || showHelp;

    const featureDisabled = (
      <React.Fragment>
        <FeatureDisabledMessage>
          {message}
          {!hideHelpToggle && (
            <HelpButton
              icon={showHelp ? 'icon-chevron-down' : 'icon-circle-info'}
              priority="link"
              size="xsmall"
              onClick={this.toggleHelp}
            >
              {t('Help')}
            </HelpButton>
          )}
        </FeatureDisabledMessage>
        {showDescription && (
          <HelpDescription>
            <p>
              {tct(
                `Enable this feature on your sentry installation by adding the
                  following configuration into your [configFile:sentry.conf.py].
                  See [configLink:the configuration documentation] for more
                  details.`,
                {
                  configFile: <code />,
                  configLink: <ExternalLink href={CONFIG_DOCS_URL} />,
                }
              )}
            </p>
            <pre onClick={e => selectText(e.target)}>
              <code>{installText(features, featureName)}</code>
            </pre>
          </HelpDescription>
        )}
      </React.Fragment>
    );

    const AlertComponent = alert === true ? Alert : alert;

    return !alert ? (
      featureDisabled
    ) : (
      <AlertComponent type="warning" icon="icon-lock">
        <AlertWrapper>{featureDisabled}</AlertWrapper>
      </AlertComponent>
    );
  }
}

const FeatureDisabledMessage = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const HelpButton = styled(Button)`
  font-size: 0.8em;
`;

const HelpDescription = styled('div')`
  font-size: 0.9em;
  margin-top: ${space(1)};

  p {
    line-height: 1.5em;
  }

  pre,
  code {
    margin-bottom: 0;
    white-space: pre;
  }
`;

const AlertWrapper = styled('div')`
  ${HelpButton} {
    color: #6d6319;
    &:hover {
      color: #88750b;
    }
  }

  pre,
  code {
    background: #fbf7e0;
  }
`;

export default FeatureDisabled;
