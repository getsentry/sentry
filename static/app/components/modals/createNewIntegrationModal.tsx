import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';

export type CreateNewIntegrationModalOptions = {
  orgSlug: string;
};

type Props = ModalRenderProps & CreateNewIntegrationModalOptions;

function CreateNewIntegration({Body, Header, Footer, closeModal, orgSlug}: Props) {
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
              <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/#internal-integrations">
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
              <ExternalLink href="https://docs.sentry.io/product/integrations/integration-platform/#public-integrations">
                {t('Public Integrations')}
              </ExternalLink>
            ),
          }
        )}
      </RadioChoiceDescription>,
    ],
  ] as [string, ReactNode, ReactNode][];

  return (
    <Fragment>
      <Header>
        <h3>{t('Choose Integration Type')}</h3>
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
        <Button size="small" onClick={() => closeModal()} style={{marginRight: space(1)}}>
          {t('Cancel')}
        </Button>
        <Button
          priority="primary"
          size="small"
          to={`/settings/${orgSlug}/developer-settings/${
            option === 'public' ? 'new-public' : 'new-internal'
          }/`}
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
export default CreateNewIntegration;
