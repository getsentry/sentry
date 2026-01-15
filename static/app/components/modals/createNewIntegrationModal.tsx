import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';
import ExampleIntegrationButton from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

const analyticsView = 'new_integration_modal';

function CreateNewIntegrationModal({Body, Header, Footer, closeModal}: ModalRenderProps) {
  const organization = useOrganization();
  const [option, selectOption] = useState('internal');
  const choices = [
    [
      'internal',
      <RadioChoiceHeader data-test-id="internal-integration" key="header-internal">
        {t('Internal Integration')}
      </RadioChoiceHeader>,
      <RadioChoiceDescription key="description-internal">
        {tct(
          'Internal integrations are meant for custom integrations unique to your organization. See more info on [docsLink].',
          {
            docsLink: (
              <ExternalLink
                href={platformEventLinkMap[PlatformEvents.INTERNAL_DOCS]}
                onClick={() => {
                  trackIntegrationAnalytics(PlatformEvents.INTERNAL_DOCS, {
                    organization,
                    view: analyticsView,
                  });
                }}
              >
                {t('Internal Integrations')}
              </ExternalLink>
            ),
          }
        )}
      </RadioChoiceDescription>,
    ],
    [
      'public',
      <RadioChoiceHeader data-test-id="public-integration" key="header-public">
        {t('Public Integration')}
      </RadioChoiceHeader>,
      <RadioChoiceDescription key="description-public">
        {tct(
          'A public integration will be available for all Sentry users for installation. See more info on [docsLink].',
          {
            docsLink: (
              <ExternalLink
                href={platformEventLinkMap[PlatformEvents.PUBLIC_DOCS]}
                onClick={() => {
                  trackIntegrationAnalytics(PlatformEvents.PUBLIC_DOCS, {
                    organization,
                    view: analyticsView,
                  });
                }}
              >
                {t('Public Integrations')}
              </ExternalLink>
            ),
          }
        )}
      </RadioChoiceDescription>,
    ],
  ] as Array<[string, ReactNode, ReactNode]>;

  return (
    <Fragment>
      <Header>
        <Flex justify="between" align="center" width="100%">
          <h3>{t('Choose Integration Type')}</h3>
          <ExampleIntegrationButton analyticsView={analyticsView} />
        </Flex>
      </Header>
      <Body>
        <StyledRadioGroup
          choices={choices}
          label={t('Avatar Type')}
          onChange={value => selectOption(value)}
          value={option}
        />
      </Body>
      <Footer>
        <Button size="sm" onClick={() => closeModal()} style={{marginRight: space(1)}}>
          {t('Cancel')}
        </Button>
        <LinkButton
          priority="primary"
          size="sm"
          to={`/settings/${organization.slug}/developer-settings/${
            option === 'public' ? 'new-public' : 'new-internal'
          }/`}
          onClick={() => {
            trackIntegrationAnalytics(
              option === 'public'
                ? PlatformEvents.CHOSE_PUBLIC
                : PlatformEvents.CHOSE_INTERNAL,
              {
                organization,
                view: analyticsView,
              }
            );
          }}
        >
          {t('Next')}
        </LinkButton>
      </Footer>
    </Fragment>
  );
}

const StyledRadioGroup = styled(RadioGroup)`
  grid-auto-columns: auto;
  & > label:not(:last-child) > div:last-child > * {
    padding-bottom: ${space(1)};
  }
`;
const RadioChoiceHeader = styled('h6')`
  margin: 0;
`;

const RadioChoiceDescription = styled('div')`
  color: ${p => p.theme.colors.gray500};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.6em;
`;

export default CreateNewIntegrationModal;
