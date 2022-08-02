import 'prism-sentry/index.css';

import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {isValidSampleRate, SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

import {FooterActions, Stepper, StyledNumberField} from './uniformRateModal';

export type RecommendedStepsModalProps = ModalRenderProps & {
  onGoNext: (currentClientRate: string) => void;
  onReadDocs: () => void;
  organization: Organization;
  projectId: Project['id'];
};

export function SpecifyClientRateModal({
  Header,
  Body,
  Footer,
  closeModal,
  onReadDocs,
  onGoNext,
  organization,
  projectId,
}: RecommendedStepsModalProps) {
  const [currentClientInput, setCurrentClientInput] = useState<undefined | string>(
    undefined
  );

  function handleReadDocs() {
    trackAdvancedAnalyticsEvent('sampling.settings.modal.specify.client.rate_read_docs', {
      organization,
      project_id: projectId,
    });

    onReadDocs();
  }

  function handleGoNext() {
    trackAdvancedAnalyticsEvent('sampling.settings.modal.specify.client.rate_next', {
      organization,
      project_id: projectId,
    });

    if (!currentClientInput) {
      return;
    }

    onGoNext(currentClientInput);
  }

  const isValid = isValidSampleRate(currentClientInput);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Specify current client(SDK) sample rate')}</h4>
      </Header>
      <Body>
        <StyledNumberField
          label={tct(
            'Find the [textHighlight:tracesSampleRate] option in your SDK config, and copy it’s value into the field below.',
            {
              textHighlight: <TextHighlight />,
            }
          )}
          type="number"
          name="current-client-sampling"
          placeholder="0.1"
          value={currentClientInput ?? null}
          onChange={value => {
            setCurrentClientInput(value === '' ? undefined : value);
          }}
          stacked
          flexibleControlStateSize
          inline={false}
        />
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} onClick={handleReadDocs} external>
            {t('Read Docs')}
          </Button>
          <ButtonBar gap={1}>
            <Stepper>{t('Step 1 of 3')}</Stepper>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              onClick={handleGoNext}
              disabled={!isValid}
              title={!isValid ? t('Sample rate is not valid') : undefined}
            >
              {t('Next')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const TextHighlight = styled('span')`
  color: ${p => p.theme.gray300};
`;
