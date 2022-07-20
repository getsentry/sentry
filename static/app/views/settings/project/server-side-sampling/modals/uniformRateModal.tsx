import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {NumberField} from 'sentry/components/forms';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {Project, SeriesApi} from 'sentry/types';
import {SamplingRule, UniformModalsSubmit} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatPercentage} from 'sentry/utils/formatters';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SamplingSDKAlert} from '../samplingSDKAlert';
import {
  isValidSampleRate,
  percentageToRate,
  rateToPercentage,
  SERVER_SIDE_SAMPLING_DOC_LINK,
} from '../utils';
import {projectStatsToPredictedSeries} from '../utils/projectStatsToPredictedSeries';
import {projectStatsToSampleRates} from '../utils/projectStatsToSampleRates';
import {projectStatsToSeries} from '../utils/projectStatsToSeries';
import useProjectStats from '../utils/useProjectStats';
import {useRecommendedSdkUpgrades} from '../utils/useRecommendedSdkUpgrades';

import {RecommendedStepsModal, RecommendedStepsModalProps} from './recommendedStepsModal';
import {UniformRateChart} from './uniformRateChart';

enum Strategy {
  CURRENT = 'current',
  RECOMMENDED = 'recommended',
}

enum Step {
  SET_UNIFORM_SAMPLE_RATE = 'set_uniform_sample_rate',
  RECOMMENDED_STEPS = 'recommended_steps',
}

type Props = Omit<
  RecommendedStepsModalProps,
  'onSubmit' | 'recommendedSdkUpgrades' | 'projectId' | 'recommendedSampleRate'
> & {
  onSubmit: UniformModalsSubmit;
  project: Project;
  rules: SamplingRule[];
  projectStats?: SeriesApi;
};

function UniformRateModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  projectStats,
  project,
  uniformRule,
  rules,
  onSubmit,
  onReadDocs,
  ...props
}: Props) {
  const modalStore = useLegacyStore(ModalStore);

  const {projectStats: projectStats30d, loading: loading30d} = useProjectStats({
    orgSlug: organization.slug,
    projectId: project.id,
    interval: '1d',
    statsPeriod: '30d',
  });

  const {recommendedSdkUpgrades} = useRecommendedSdkUpgrades({
    orgSlug: organization.slug,
  });

  const loading = loading30d || !projectStats;

  const [activeStep, setActiveStep] = useState<Step>(Step.SET_UNIFORM_SAMPLE_RATE);

  useEffect(() => {
    if (modalStore.renderer === null) {
      trackAdvancedAnalyticsEvent(
        activeStep === Step.RECOMMENDED_STEPS
          ? 'sampling.settings.modal.recommended.next.steps_cancel'
          : 'sampling.settings.modal.uniform.rate_cancel',
        {
          organization,
          project_id: project.id,
        }
      );
    }
  }, [activeStep, modalStore.renderer, organization, project.id]);

  const uniformSampleRate = uniformRule?.sampleRate;

  const {trueSampleRate, maxSafeSampleRate} = projectStatsToSampleRates(projectStats);

  const currentClientSampling =
    defined(trueSampleRate) && !isNaN(trueSampleRate) ? trueSampleRate : undefined;
  const currentServerSampling =
    defined(uniformSampleRate) && !isNaN(uniformSampleRate)
      ? uniformSampleRate
      : undefined;
  const recommendedClientSampling =
    defined(maxSafeSampleRate) && !isNaN(maxSafeSampleRate)
      ? maxSafeSampleRate
      : undefined;
  const recommendedServerSampling = currentClientSampling;

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>(Strategy.CURRENT);
  const [clientInput, setClientInput] = useState(
    rateToPercentage(recommendedClientSampling)
  );
  const [serverInput, setServerInput] = useState(
    rateToPercentage(recommendedServerSampling)
  );
  // ^^^ We use clientInput and serverInput variables just for the text fields, everywhere else we should use client and server variables vvv

  const client = percentageToRate(clientInput);
  const server = percentageToRate(serverInput);

  const [saving, setSaving] = useState(false);

  const shouldHaveNextStep =
    client !== currentClientSampling || recommendedSdkUpgrades.length > 0;

  useEffect(() => {
    setClientInput(rateToPercentage(recommendedClientSampling));
    setServerInput(rateToPercentage(recommendedServerSampling));
  }, [recommendedClientSampling, recommendedServerSampling]);

  useEffect(() => {
    trackAdvancedAnalyticsEvent(
      selectedStrategy === Strategy.RECOMMENDED
        ? 'sampling.settings.modal.uniform.rate_switch_recommended'
        : 'sampling.settings.modal.uniform.rate_switch_current',
      {
        organization,
        project_id: project.id,
      }
    );
  }, [selectedStrategy, organization, project.id]);

  const isEdited =
    client !== recommendedClientSampling || server !== recommendedServerSampling;

  const isValid = isValidSampleRate(client) && isValidSampleRate(server);

  function handlePrimaryButtonClick() {
    // this can either be "Next" or "Done"

    if (!isValid) {
      return;
    }

    if (shouldHaveNextStep) {
      trackAdvancedAnalyticsEvent('sampling.settings.modal.uniform.rate_next', {
        organization,
        project_id: project.id,
      });

      setActiveStep(Step.RECOMMENDED_STEPS);
      return;
    }

    setSaving(true);

    onSubmit({
      recommendedSampleRate: !isEdited,
      uniformRateModalOrigin: true,
      sampleRate: server!,
      rule: uniformRule,
      onSuccess: () => {
        setSaving(false);
        closeModal();
      },
      onError: () => {
        setSaving(false);
      },
    });
  }

  function handleReadDocs() {
    trackAdvancedAnalyticsEvent('sampling.settings.modal.uniform.rate_read_docs', {
      organization,
      project_id: project.id,
    });

    onReadDocs();
  }

  if (activeStep === Step.RECOMMENDED_STEPS) {
    return (
      <RecommendedStepsModal
        {...props}
        Header={Header}
        Body={Body}
        Footer={Footer}
        closeModal={closeModal}
        organization={organization}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
        onGoBack={() => setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE)}
        onSubmit={onSubmit}
        onReadDocs={onReadDocs}
        clientSampleRate={client}
        serverSampleRate={server}
        uniformRule={uniformRule}
        projectId={project.id}
        recommendedSampleRate={!isEdited}
      />
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Define a global sample rate')}</h4>
      </Header>
      <Body>
        <TextBlock>
          {tct(
            'Set a global sample rate for the percent of transactions you want to process (Client) and those you want to index (Server) for your project. Below are suggested rates based on your organization’s usage and quota. Once set, the number of transactions processed and indexed for this project come from your organization’s overall quota and might impact the amount of transactions retained for other projects. [learnMoreLink:Learn more about quota management.]',
            {
              learnMoreLink: <ExternalLink href="" />,
            }
          )}
        </TextBlock>

        {loading ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
            <UniformRateChart
              series={
                selectedStrategy === Strategy.CURRENT
                  ? projectStatsToSeries(projectStats30d)
                  : projectStatsToPredictedSeries(projectStats30d, client, server)
              }
              isLoading={loading30d}
            />

            <StyledPanelTable
              headers={[
                t('Sampling Values'),
                <RightAligned key="client">{t('Client')}</RightAligned>,
                <RightAligned key="server">{t('Server')}</RightAligned>,
                '',
              ]}
            >
              <Fragment>
                <Label htmlFor="sampling-current">
                  <Radio
                    id="sampling-current"
                    checked={selectedStrategy === Strategy.CURRENT}
                    onChange={() => {
                      setSelectedStrategy(Strategy.CURRENT);
                    }}
                  />
                  {t('Current')}
                </Label>
                <RightAligned>
                  {defined(currentClientSampling)
                    ? formatPercentage(currentClientSampling)
                    : 'N/A'}
                </RightAligned>
                <RightAligned>
                  {defined(currentServerSampling)
                    ? formatPercentage(currentServerSampling)
                    : 'N/A'}
                </RightAligned>
                <div />
              </Fragment>
              <Fragment>
                <Label htmlFor="sampling-recommended">
                  <Radio
                    id="sampling-recommended"
                    checked={selectedStrategy === Strategy.RECOMMENDED}
                    onChange={() => {
                      setSelectedStrategy(Strategy.RECOMMENDED);
                    }}
                  />
                  {isEdited ? t('New') : t('Suggested')}
                  {!isEdited && (
                    <QuestionTooltip
                      title={t(
                        'These are suggested sample rates you can set based on your organization’s overall usage and quota.'
                      )}
                      size="sm"
                    />
                  )}
                </Label>
                <RightAligned>
                  <StyledNumberField
                    name="recommended-client-sampling"
                    placeholder="%"
                    value={clientInput ?? null}
                    onChange={value => {
                      setClientInput(value === '' ? undefined : value);
                    }}
                    onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                    stacked
                    flexibleControlStateSize
                    inline={false}
                  />
                </RightAligned>
                <RightAligned>
                  <StyledNumberField
                    name="recommended-server-sampling"
                    placeholder="%"
                    value={serverInput ?? null}
                    onChange={value => {
                      setServerInput(value === '' ? undefined : value);
                    }}
                    onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                    stacked
                    flexibleControlStateSize
                    inline={false}
                  />
                </RightAligned>
                <ResetButton>
                  {isEdited && (
                    <Button
                      icon={<IconRefresh size="sm" />}
                      aria-label={t('Reset to suggested values')}
                      onClick={() => {
                        setClientInput(rateToPercentage(recommendedClientSampling));
                        setServerInput(rateToPercentage(recommendedServerSampling));
                      }}
                      borderless
                      size="zero"
                    />
                  )}
                </ResetButton>
              </Fragment>
            </StyledPanelTable>

            <SamplingSDKAlert
              organization={organization}
              projectId={project.id}
              rules={rules}
              recommendedSdkUpgrades={recommendedSdkUpgrades}
              showLinkToTheModal={false}
              onReadDocs={onReadDocs}
            />
          </Fragment>
        )}
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} onClick={handleReadDocs} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            {shouldHaveNextStep && <Stepper>{t('Step 1 of 2')}</Stepper>}
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              onClick={handlePrimaryButtonClick}
              disabled={saving || !isValid || selectedStrategy === Strategy.CURRENT}
              title={
                selectedStrategy === Strategy.CURRENT
                  ? t('Current sampling values selected')
                  : !isValid
                  ? t('Sample rate is not valid')
                  : undefined
              }
            >
              {shouldHaveNextStep ? t('Next') : t('Done')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 115px 115px 35px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const RightAligned = styled('div')`
  text-align: right;
`;

const ResetButton = styled('div')`
  padding-left: 0;
  display: inline-flex;
`;

const Label = styled('label')`
  font-weight: 400;
  display: inline-flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
`;

const StyledNumberField = styled(NumberField)`
  width: 100%;
`;

export const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

export const Stepper = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

export {UniformRateModal};
