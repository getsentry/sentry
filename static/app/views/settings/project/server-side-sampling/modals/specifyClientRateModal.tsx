import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {isValidSampleRate, SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

import {FooterActions, Stepper, StyledNumberField} from './uniformRateModal';

type SpecifyClientRateModalProps = ModalRenderProps & {
  onChange: (value: number | undefined) => void;
  onGoNext: () => void;
  onReadDocs: () => void;
  organization: Organization;
  projectId: Project['id'];
  value: number | undefined;
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
  value,
  onChange,
}: SpecifyClientRateModalProps) {
  useEffect(() => {
    trackAdvancedAnalyticsEvent('sampling.settings.modal.specify.client.open', {
      organization,
      project_id: projectId,
    });
  }, [organization, projectId]);

  useEffect(() => {
    onChange(0.1);
  }, [onChange]);

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

    if (!defined(value)) {
      return;
    }

    onGoNext();
  }

  const isValid = isValidSampleRate(value);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Current SDK Sample Rate')}</h4>
      </Header>
      <Body>
        <StyledNumberField
          label={tct(
            'We are not able to estimate your client sample rate. For a more accurate estimation find the [textHighlight:tracesSampleRate] option in your SDK config, and copy it’s value into the field below.',
            {
              textHighlight: <TextHighlight />,
            }
          )}
          name="current-client-sampling"
          placeholder="0.1"
          step="0.1"
          value={value ?? null}
          onChange={newValue => {
            onChange(newValue === '' ? undefined : newValue);
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
              title={
                !value
                  ? t('Sample rate must not be empty')
                  : !isValid
                  ? t('Sample rate is not valid')
                  : undefined
              }
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
