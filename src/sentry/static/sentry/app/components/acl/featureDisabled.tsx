import React from 'react';
import styled from '@emotion/styled';

import {selectText} from 'app/utils/selectText';
import {IconInfo, IconChevron, IconLock, IconCopy} from 'app/icons';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import ExternalLink from 'app/components/links/externalLink';
import space from 'app/styles/space';
import {CONFIG_DOCS_URL} from 'app/constants';

const installText = (features: string[], featureName: string): string =>
  `# ${t('Enables the %s feature', featureName)}\n${features
    .map(f => `SENTRY_FEATURES['${f}'] = True`)
    .join('\n')}`;

type Props = {
  /**
   * The feature flag keys that should be displayed in the code example for
   * enabling the feature.
   */
  features: string[];
  /**
   * The English name of the feature. This is used in the comment that will
   * be outputted above the example line of code to enable the feature.
   */
  featureName: string;
  /**
   * Render the disabled message within a warning Alert. A custom Alert
   * component may be provided.
   *
   * Attaches additional styles to the FeatureDisabled component to make it
   * look consistent within the Alert.
   */
  alert?: boolean | React.ElementType;
  /**
   * Do not show the help toggle. The description will always be rendered.
   */
  hideHelpToggle?: boolean;
  /**
   * A custom message to display. Defaults to a generic disabled message.
   */
  message: string;
};

type State = {
  showHelp: boolean;
};

/**
 * DisabledInfo renders a component informing that a feature has been disabled.
 *
 * By default this component will render a help button which toggles more
 * information about why the feature is disabled, showing the missing feature
 * flag and linking to documentation for managing sentry server feature flags.
 */
class FeatureDisabled extends React.Component<Props, State> {
  static defaultProps: Partial<Props> = {
    message: t('This feature is not enabled on your Sentry installation.'),
  };

  state = {
    showHelp: false,
  };

  toggleHelp = (e: React.MouseEvent) => {
    e.preventDefault();
    this.setState(state => ({showHelp: !state.showHelp}));
  };

  renderFeatureDisabled() {
    const {showHelp} = this.state;
    const {message, features, featureName, hideHelpToggle} = this.props;
    const showDescription = hideHelpToggle || showHelp;

    return (
      <React.Fragment>
        <FeatureDisabledMessage>
          {message}
          {!hideHelpToggle && (
            <HelpButton
              icon={
                showHelp ? (
                  <IconChevron direction="down" size="xs" />
                ) : (
                  <IconInfo size="xs" />
                )
              }
              priority="link"
              size="xsmall"
              onClick={this.toggleHelp}
            >
              {t('Help')}
            </HelpButton>
          )}
        </FeatureDisabledMessage>
        {showDescription && (
          <HelpDescription
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
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
            <Clipboard hideUnsupported value={installText(features, featureName)}>
              <Button
                borderless
                size="xsmall"
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                icon={<IconCopy />}
              >
                {t('Copy to Clipboard')}
              </Button>
            </Clipboard>
            <pre onClick={e => selectText(e.target as HTMLElement)}>
              <code>{installText(features, featureName)}</code>
            </pre>
          </HelpDescription>
        )}
      </React.Fragment>
    );
  }

  render() {
    const {alert} = this.props;

    if (!alert) {
      return this.renderFeatureDisabled();
    }

    const AlertComponent = typeof alert === 'boolean' ? Alert : alert;

    return (
      <AlertComponent type="warning" icon={<IconLock size="xs" />}>
        <AlertWrapper>{this.renderFeatureDisabled()}</AlertWrapper>
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
