import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button, ButtonLabel} from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import ExternalLink from 'sentry/components/links/externalLink';
import {CONFIG_DOCS_URL} from 'sentry/constants';
import {IconChevron, IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {selectText} from 'sentry/utils/selectText';

const installText = (features: string[], featureName: string): string =>
  `# ${t('Enables the %s feature', featureName)}\n${features
    .map(f => `SENTRY_FEATURES['${f}'] = True`)
    .join('\n')}`;

type Props = {
  /**
   * The English name of the feature. This is used in the comment that will
   * be outputted above the example line of code to enable the feature.
   */
  featureName: string;
  /**
   * The feature flag keys that should be displayed in the code example for
   * enabling the feature.
   */
  features: string[];
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
  message?: string;
};

/**
 * DisabledInfo renders a component informing that a feature has been disabled.
 *
 * By default this component will render a help button which toggles more
 * information about why the feature is disabled, showing the missing feature
 * flag and linking to documentation for managing sentry server feature flags.
 */
function FeatureDisabled({
  features,
  featureName,
  alert,
  hideHelpToggle,
  message = t('This feature is not enabled on your Sentry installation.'),
}: Props) {
  const [showHelp, setShowHelp] = useState(false);

  function renderHelp() {
    return (
      <Fragment>
        <HelpText>
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
        </HelpText>
        <Clipboard hideUnsupported value={installText(features, featureName)}>
          <CopyButton borderless size="xs" icon={<IconCopy size="xs" />}>
            {t('Copy to Clipboard')}
          </CopyButton>
        </Clipboard>
        <Pre onClick={e => selectText(e.target as HTMLElement)}>
          <code>{installText(features, featureName)}</code>
        </Pre>
      </Fragment>
    );
  }

  if (!alert) {
    const showDescription = hideHelpToggle || showHelp;
    return (
      <Fragment>
        <FeatureDisabledMessage>
          {message}
          {!hideHelpToggle && (
            <ToggleButton
              priority="link"
              size="xs"
              onClick={() => setShowHelp(!showHelp)}
            >
              {t('Help')}
              <IconChevron direction={showDescription ? 'up' : 'down'} />
            </ToggleButton>
          )}
        </FeatureDisabledMessage>
        {showDescription && <HelpDescription>{renderHelp()}</HelpDescription>}
      </Fragment>
    );
  }

  const AlertComponent = typeof alert === 'boolean' ? Alert : alert;
  return (
    <AlertComponent type="warning" showIcon expand={renderHelp()}>
      {message}
    </AlertComponent>
  );
}

const FeatureDisabledMessage = styled('div')`
  display: flex;
  justify-content: space-between;
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const HelpDescription = styled('div')`
  margin-top: ${space(1)};

  pre,
  code {
    margin-bottom: 0;
    white-space: pre;
  }

  button {
    margin-bottom: ${space(0.5)};
  }
`;

const HelpText = styled('p')`
  margin-bottom: ${space(1)};
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.active};
  height: ${p => p.theme.text.lineHeightBody}em;
  min-height: ${p => p.theme.text.lineHeightBody}em;

  &:hover {
    color: ${p => p.theme.activeHover};
  }

  ${ButtonLabel} {
    display: grid;
    grid-auto-flow: column;
    gap: ${space(1)};
  }
`;

const CopyButton = styled(Button)`
  margin-left: auto;
`;

const Pre = styled('pre')`
  margin-bottom: 0;
  overflow: auto;
`;

export default FeatureDisabled;
