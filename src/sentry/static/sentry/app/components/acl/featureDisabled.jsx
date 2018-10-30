import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ExternalLink from 'app/components/externalLink';

const CONFIG_DOCS_URL = 'https://docs.sentry.io/server/config/';

/**
 * DisabledInfo renders a component informing that a feature has been disabled.
 *
 * By default this component will render a help button which toggles more
 * information about why the feature is disabled, showing the missing feature
 * flag and linking to documentation for managing sentry server feature flags.
 */
class FeatureDisabled extends React.Component {
  static propTypes = {
    feature: PropTypes.string,
    featureName: PropTypes.string,
    hideHelpToggle: PropTypes.bool,
    alert: PropTypes.bool,
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
    const {feature, featureName, hideHelpToggle, alert} = this.props;

    const featureDisabled = (
      <React.Fragment>
        <Flex justify="space-between">
          {t('This feature is not enabled on your Sentry installation.')}
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
        </Flex>
        {showHelp && (
          <HelpDescription mt={1}>
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
            <pre>
              <code
              >{`# Enables the ${featureName} feature\nSENTRY_FEATURES['${feature}'] = True`}</code>
            </pre>
          </HelpDescription>
        )}
      </React.Fragment>
    );

    return !alert ? (
      featureDisabled
    ) : (
      <StyledAlert type="warning" icon="icon-labs">
        {featureDisabled}
      </StyledAlert>
    );
  }
}

const HelpButton = styled(Button)`
  font-size: 0.8em;
`;

const HelpDescription = styled(Box)`
  font-size: 0.9em;

  p {
    line-height: 1.5em;
  }

  pre {
    margin-bottom: 0;
  }
`;

const StyledAlert = styled(Alert)`
  ${/* sc-selector */ HelpButton} {
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
