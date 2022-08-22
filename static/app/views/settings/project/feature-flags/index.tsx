import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import BooleanField from 'sentry/components/forms/booleanField';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import flags from './flags.json';

export default function FeatureFlags() {
  const [state, setState] = useState(flags);

  return (
    <SentryDocumentTitle title={t('Feature Flags')}>
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              {t('Feature Flags')} <FeatureBadge type="beta" />
            </Fragment>
          }
        />
        <TextBlock>
          {tct(
            'Feature flags allow you to configure your code into different flavors by dynamically toggling certain functionality on and off. Learn more about feature flags in our [link:documentation].',
            {
              link: <ExternalLink href="" />,
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>{t('Feature Flags')}</PanelHeader>
          <PanelBody>
            {Object.keys(state).map(flag => (
              <BooleanField
                key={flag}
                name={flag}
                value={state[flag].state}
                label={state[flag].name ?? startCase(flag)}
                help={state[flag].description}
                onChange={value => {
                  setState({
                    ...state,
                    [flag]: {
                      ...state[flag],
                      state: value,
                    },
                  });
                }}
              />
            ))}
          </PanelBody>
          <PanelActions>
            <ButtonBar gap={1}>
              <Button href="" external>
                {t('Read Docs')}
              </Button>
              <Button onClick={() => {}} priority="primary">
                {t('Add Flag')}
              </Button>
            </ButtonBar>
          </PanelActions>
        </Panel>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const PanelActions = styled(PanelFooter)`
  padding: ${space(1.5)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
