import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';
import ExampleIntegrationButton from 'sentry/views/settings/organizationIntegrations/exampleIntegrationButton';

export type CreateNewIntegrationModalOptions = {organization: Organization};
type CreateNewIntegrationModalProps = CreateNewIntegrationModalOptions & ModalRenderProps;

const analyticsView = 'new_integration_modal' as const;

function CreateNewIntegrationModal({
  Body,
  Header,
  Footer,
  closeModal,
  organization,
}: CreateNewIntegrationModalProps) {
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
  ] as [string, ReactNode, ReactNode][];

  if (organization.features.includes('sentry-functions')) {
    choices.push([
      'sentry-fx',
      <RadioChoiceHeader data-test-id="sentry-function" key="header-sentryfx">
        {t('Sentry Function')}
      </RadioChoiceHeader>,
      <RadioChoiceDescription key="description-sentry-function">
        {t(
          'A Sentry Function is a new type of integration leveraging the power of cloud functions.'
        )}
      </RadioChoiceDescription>,
    ]);
  }

  return (
    <Fragment>
      <Header>
        <HeaderWrapper>
          <h3>{t('Choose Integration Type')}</h3>
          <ExampleIntegrationButton analyticsView={analyticsView} />
        </HeaderWrapper>
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
        <Button
          priority="primary"
          size="sm"
          to={
            option === 'sentry-fx'
              ? `/settings/${organization.slug}/developer-settings/sentry-functions/new/`
              : `/settings/${organization.slug}/developer-settings/${
                  option === 'public' ? 'new-public' : 'new-internal'
                }/`
          }
          onClick={() => {
            trackIntegrationAnalytics(
              option === 'sentry-fx'
                ? PlatformEvents.CHOSE_SENTRY_FX
                : option === 'public'
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
        </Button>
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
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.6em;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

export default withOrganization(CreateNewIntegrationModal);
