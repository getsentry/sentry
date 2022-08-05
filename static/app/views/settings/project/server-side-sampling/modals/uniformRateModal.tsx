import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {NumberField} from 'sentry/components/forms';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import Tooltip from 'sentry/components/tooltip';
import {IconRefresh, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ModalStore from 'sentry/stores/modalStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {Project, SeriesApi} from 'sentry/types';
import {SamplingRule, UniformModalsSubmit} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatPercentage} from 'sentry/utils/formatters';
import {Outcome} from 'sentry/views/organizationStats/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SamplingSDKAlert} from '../samplingSDKAlert';
import {
  isValidSampleRate,
  percentageToRate,
  rateToPercentage,
  SERVER_SIDE_SAMPLING_DOC_LINK,
} from '../utils';
import {hasFirstBucketsEmpty} from '../utils/hasFirstBucketsEmpty';
import {projectStatsToPredictedSeries} from '../utils/projectStatsToPredictedSeries';
import {projectStatsToSampleRates} from '../utils/projectStatsToSampleRates';
import {projectStatsToSeries} from '../utils/projectStatsToSeries';
import useProjectStats from '../utils/useProjectStats';
import {useRecommendedSdkUpgrades} from '../utils/useRecommendedSdkUpgrades';

import {RecommendedStepsModal, RecommendedStepsModalProps} from './recommendedStepsModal';
import {SpecifyClientRateModal} from './specifyClientRateModal';
import {UniformRateChart} from './uniformRateChart';

const CONSERVATIVE_SAMPLE_RATE = 0.1;

enum Strategy {
  CURRENT = 'current',
  RECOMMENDED = 'recommended',
}

enum Step {
  SET_CURRENT_CLIENT_SAMPLE_RATE = 'set_current_client_sample_rate',
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

export function UniformRateModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  projectStats,
  project,
  uniformRule,
  onSubmit,
  onReadDocs,
  ...props
}: Props) {
  const [rules, setRules] = useState(props.rules);
  const [specifiedClientRate, setSpecifiedClientRate] = useState<undefined | number>(
    undefined
  );
  const [activeStep, setActiveStep] = useState<Step | undefined>(undefined);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>(Strategy.CURRENT);

  const modalStore = useLegacyStore(ModalStore);

  const {
    projectStats: projectStats30d,
    // TODO(sampling): check how to render this error in the UI
    error: _error30d,
    loading: loading30d,
  } = useProjectStats({
    orgSlug: organization.slug,
    projectId: project.id,
    interval: '1d',
    statsPeriod: '30d',
  });

  const {recommendedSdkUpgrades} = useRecommendedSdkUpgrades({
    orgSlug: organization.slug,
  });

  const loading = loading30d || !projectStats;

  useEffect(() => {
    if (loading || !projectStats30d) {
      return;
    }

    if (!projectStats30d.groups.length) {
      setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE);
      return;
    }

    const clientDiscard = projectStats30d.groups.some(
      g => g.by.outcome === Outcome.CLIENT_DISCARD
    );

    setActiveStep(
      clientDiscard ? Step.SET_UNIFORM_SAMPLE_RATE : Step.SET_CURRENT_CLIENT_SAMPLE_RATE
    );
  }, [loading, projectStats30d]);

  const shouldUseConservativeSampleRate =
    recommendedSdkUpgrades.length === 0 &&
    hasFirstBucketsEmpty(projectStats30d, 27) &&
    hasFirstBucketsEmpty(projectStats, 3) &&
    !defined(specifiedClientRate);

  useEffect(() => {
    // updated or created rules will always have a new id,
    // therefore the isEqual will always work in this case
    if (modalStore.renderer === null && isEqual(rules, props.rules)) {
      trackAdvancedAnalyticsEvent(
        activeStep === Step.SET_CURRENT_CLIENT_SAMPLE_RATE
          ? 'sampling.settings.modal.specify.client.rate_cancel'
          : activeStep === Step.RECOMMENDED_STEPS
          ? 'sampling.settings.modal.recommended.next.steps_cancel'
          : 'sampling.settings.modal.uniform.rate_cancel',
        {
          organization,
          project_id: project.id,
        }
      );
    }
  }, [activeStep, modalStore.renderer, organization, project.id, rules, props.rules]);

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

  const uniformSampleRate = uniformRule?.sampleRate;

  const {trueSampleRate, maxSafeSampleRate} = projectStatsToSampleRates(projectStats);

  const currentClientSampling =
    defined(specifiedClientRate) && !isNaN(specifiedClientRate)
      ? specifiedClientRate
      : defined(trueSampleRate) && !isNaN(trueSampleRate)
      ? trueSampleRate
      : undefined;
  const currentServerSampling =
    defined(uniformSampleRate) && !isNaN(uniformSampleRate)
      ? uniformSampleRate
      : undefined;
  const recommendedClientSampling =
    defined(maxSafeSampleRate) && !isNaN(maxSafeSampleRate)
      ? maxSafeSampleRate
      : undefined;
  const recommendedServerSampling = shouldUseConservativeSampleRate
    ? CONSERVATIVE_SAMPLE_RATE
    : Math.min(currentClientSampling ?? 1, recommendedClientSampling ?? 1);

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
      onSuccess: newRules => {
        setSaving(false);
        setRules(newRules);
        closeModal();
      },
      onError: () => {
        setSaving(false);
      },
    });
  }

  function handleReadDocs() {
    onReadDocs();

    if (activeStep === undefined) {
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.settings.modal.uniform.rate_read_docs', {
      organization,
      project_id: project.id,
    });
  }

  if (activeStep === undefined || loading) {
    return (
      <Fragment>
        <Header closeButton>
          <Placeholder height="22px" />
        </Header>
        <Body>
          <LoadingIndicator />
        </Body>
        <Footer>
          <FooterActions>
            <Button
              href={SERVER_SIDE_SAMPLING_DOC_LINK}
              onClick={handleReadDocs}
              external
            >
              {t('Read Docs')}
            </Button>
            <ButtonBar gap={1}>
              <Button onClick={closeModal}>{t('Cancel')}</Button>
              <Placeholder height="40px" width="80px" />
            </ButtonBar>
          </FooterActions>
        </Footer>
      </Fragment>
    );
  }

  if (activeStep === Step.SET_CURRENT_CLIENT_SAMPLE_RATE) {
    return (
      <SpecifyClientRateModal
        {...props}
        Header={Header}
        Body={Body}
        Footer={Footer}
        closeModal={closeModal}
        onReadDocs={onReadDocs}
        organization={organization}
        projectId={project.id}
        value={specifiedClientRate}
        onChange={setSpecifiedClientRate}
        onGoNext={() => setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE)}
      />
    );
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
        onSetRules={setRules}
      />
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Set a global sample rate')}</h4>
      </Header>
      <Body>
        <TextBlock>
          {tct(
            'Set a server-side sample rate for all transactions using our suggestion as a starting point. To accurately monitor overall performance, we also suggest changing your client(SDK) sample rate to allow more metrics to be processed. [learnMoreLink: Learn more about quota management].',
            {
              learnMoreLink: (
                <ExternalLink
                  href={`${SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#2-set-a-uniform-sampling-rate`}
                />
              ),
            }
          )}
        </TextBlock>

        <Fragment>
          <UniformRateChart
            series={
              selectedStrategy === Strategy.CURRENT
                ? projectStatsToSeries(projectStats30d, specifiedClientRate)
                : projectStatsToPredictedSeries(
                    projectStats30d,
                    client,
                    server,
                    specifiedClientRate
                  )
            }
            isLoading={loading30d}
          />

          <StyledPanelTable
            headers={[
              <SamplingValuesColumn key="sampling-values">
                {t('Sampling Values')}
              </SamplingValuesColumn>,
              <ClientColumn key="client">{t('Client')}</ClientColumn>,
              <ClientHelpOrWarningColumn key="client-rate-help" />,
              <ServerColumn key="server">{t('Server')}</ServerColumn>,
              <ServerWarningColumn key="server-warning" />,
              <RefreshRatesColumn key="refresh-rates" />,
            ]}
          >
            <Fragment>
              <SamplingValuesColumn>
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
              </SamplingValuesColumn>
              <ClientColumn>
                {defined(currentClientSampling)
                  ? formatPercentage(currentClientSampling)
                  : 'N/A'}
              </ClientColumn>
              <ClientHelpOrWarningColumn />
              <ServerColumn>
                {defined(currentServerSampling)
                  ? formatPercentage(currentServerSampling)
                  : 'N/A'}
              </ServerColumn>
              <ServerWarningColumn />
              <RefreshRatesColumn />
            </Fragment>
            <Fragment>
              <SamplingValuesColumn>
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
                        'Optimal sample rates based on your organization’s usage and quota.'
                      )}
                      size="sm"
                    />
                  )}
                </Label>
              </SamplingValuesColumn>
              <ClientColumn>
                <StyledNumberField
                  name="recommended-client-sampling"
                  placeholder="%"
                  step="10"
                  value={clientInput ?? null}
                  onChange={value => {
                    setClientInput(value === '' ? undefined : value);
                  }}
                  onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                  stacked
                  flexibleControlStateSize
                  inline={false}
                />
              </ClientColumn>
              <ClientHelpOrWarningColumn>
                {isEdited && !isValidSampleRate(percentageToRate(clientInput)) ? (
                  <Tooltip
                    title={t('Set a value between 0 and 100')}
                    containerDisplayMode="inline-flex"
                  >
                    <IconWarning
                      color="red300"
                      size="sm"
                      data-test-id="invalid-client-rate"
                    />
                  </Tooltip>
                ) : (
                  <QuestionTooltip
                    title={t(
                      'Changing the client(SDK) sample rate will require re-deployment.'
                    )}
                    size="sm"
                  />
                )}
              </ClientHelpOrWarningColumn>
              <ServerColumn>
                <StyledNumberField
                  name="recommended-server-sampling"
                  placeholder="%"
                  step="10"
                  value={serverInput ?? null}
                  onChange={value => {
                    setServerInput(value === '' ? undefined : value);
                  }}
                  onFocus={() => setSelectedStrategy(Strategy.RECOMMENDED)}
                  stacked
                  flexibleControlStateSize
                  inline={false}
                />
              </ServerColumn>
              <ServerWarningColumn>
                {isEdited && !isValidSampleRate(percentageToRate(serverInput)) && (
                  <Tooltip
                    title={t('Set a value between 0 and 100')}
                    containerDisplayMode="inline-flex"
                  >
                    <IconWarning
                      color="red300"
                      size="sm"
                      data-test-id="invalid-server-rate"
                    />
                  </Tooltip>
                )}
              </ServerWarningColumn>
              <RefreshRatesColumn>
                {isEdited && (
                  <Button
                    title={t('Reset to suggested values')}
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
              </RefreshRatesColumn>
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

          {shouldUseConservativeSampleRate && (
            <Alert type="info" showIcon>
              {t(
                "For accurate suggestions, we need at least 48hrs to ingest transactions. Meanwhile, here's a conservative server-side sampling rate which can be changed later on."
              )}
            </Alert>
          )}
        </Fragment>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} onClick={handleReadDocs} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            {shouldHaveNextStep && (
              <Stepper>
                {defined(specifiedClientRate) ? t('Step 2 of 3') : t('Step 1 of 2')}
              </Stepper>
            )}
            {defined(specifiedClientRate) ? (
              <Button onClick={() => setActiveStep(Step.SET_CURRENT_CLIENT_SAMPLE_RATE)}>
                {t('Back')}
              </Button>
            ) : (
              <Button onClick={closeModal}>{t('Cancel')}</Button>
            )}
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
  grid-template-columns: 1fr 115px 24px 115px 16px 46px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  > * {
    padding: 0;
  }
`;

const Label = styled('label')`
  font-weight: 400;
  display: inline-flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
`;

export const StyledNumberField = styled(NumberField)`
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

const SamplingValuesColumn = styled('div')`
  padding: ${space(2)};
  display: flex;
`;

const ClientColumn = styled('div')`
  padding: ${space(2)} ${space(1)} ${space(2)} ${space(2)};
  text-align: right;
  display: flex;
  justify-content: flex-end;
`;

const ClientHelpOrWarningColumn = styled('div')`
  padding: ${space(2)} ${space(1)} ${space(2)} 0;
  display: flex;
  align-items: center;
`;

const ServerColumn = styled('div')`
  padding: ${space(2)} ${space(1)} ${space(2)} ${space(2)};
  text-align: right;
  display: flex;
  justify-content: flex-end;
`;

const ServerWarningColumn = styled('div')`
  padding: ${space(2)} 0;
  display: flex;
  align-items: center;
`;

const RefreshRatesColumn = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(2)} ${space(1)};
  display: inline-flex;
`;
