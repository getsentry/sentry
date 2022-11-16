import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {fetchProjectStats} from 'sentry/actionCreators/serverSideSampling';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {NumberField} from 'sentry/components/forms';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
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
import {Outcome, Project} from 'sentry/types';
import {SamplingRule, UniformModalsSubmit} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatPercentage} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {
  getClientSampleRates,
  isValidSampleRate,
  percentageToRate,
  rateToPercentage,
  SERVER_SIDE_SAMPLING_DOC_LINK,
} from '../utils';
import {hasFirstBucketsEmpty} from '../utils/hasFirstBucketsEmpty';
import {projectStatsToPredictedSeries} from '../utils/projectStatsToPredictedSeries';
import {projectStatsToSeries} from '../utils/projectStatsToSeries';
import {useProjectStats} from '../utils/useProjectStats';
import {useRecommendedSdkUpgrades} from '../utils/useRecommendedSdkUpgrades';

import {AffectOtherProjectsTransactionsAlert} from './affectOtherProjectsTransactionsAlert';
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
};

export function UniformRateModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  project,
  uniformRule,
  onSubmit,
  onReadDocs,
  ...props
}: Props) {
  const api = useApi();
  const [rules, setRules] = useState(props.rules);
  const [specifiedClientRate, setSpecifiedClientRate] = useState<undefined | number>(
    undefined
  );
  const [activeStep, setActiveStep] = useState<Step | undefined>(undefined);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>(
    Strategy.RECOMMENDED
  );

  const modalStore = useLegacyStore(ModalStore);

  const {projectStats30d, projectStats48h} = useProjectStats();

  const {
    recommendedSdkUpgrades,
    affectedProjects,
    isProjectIncompatible,
    isProjectOnOldSDK,
    loading: sdkUpgradesLoading,
  } = useRecommendedSdkUpgrades({
    organization,
    projectId: project.id,
  });

  const loading =
    projectStats30d.loading || projectStats48h.loading || sdkUpgradesLoading;

  const error = projectStats30d.error || projectStats48h.error;

  useEffect(() => {
    if (loading || !projectStats30d.data) {
      return;
    }

    if (!projectStats30d.data.groups.length) {
      setActiveStep(Step.SET_UNIFORM_SAMPLE_RATE);
      return;
    }

    const clientDiscard = projectStats30d.data.groups.some(
      g => g.by.outcome === Outcome.CLIENT_DISCARD
    );

    setActiveStep(
      clientDiscard || !isProjectOnOldSDK
        ? Step.SET_UNIFORM_SAMPLE_RATE
        : Step.SET_CURRENT_CLIENT_SAMPLE_RATE
    );
  }, [loading, projectStats30d.data, isProjectOnOldSDK]);

  const shouldUseConservativeSampleRate =
    hasFirstBucketsEmpty(projectStats30d.data, 27) &&
    hasFirstBucketsEmpty(projectStats48h.data, 3) &&
    !defined(specifiedClientRate);

  const isWithoutTransactions =
    projectStats30d.data?.groups.reduce(
      (acc, group) => acc + group.totals['sum(quantity)'],
      0
    ) === 0;

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

  const {recommended: recommendedClientSampling, current: currentClientSampling} =
    getClientSampleRates(projectStats48h.data, specifiedClientRate);

  const currentServerSampling =
    defined(uniformSampleRate) && !isNaN(uniformSampleRate)
      ? uniformSampleRate
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

  const isServerRateHigherThanClientRate =
    defined(client) && defined(server) ? client < server : false;

  const isValid =
    isValidSampleRate(client) &&
    isValidSampleRate(server) &&
    !isServerRateHigherThanClientRate;

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

  async function handleRefetchProjectStats() {
    await fetchProjectStats({api, orgSlug: organization.slug, projId: project.id});
  }

  if (activeStep === undefined || loading || error) {
    return (
      <Fragment>
        <Header closeButton>
          {error ? (
            <h4>{t('Set a global sample rate')}</h4>
          ) : (
            <Placeholder height="22px" />
          )}
        </Header>
        <Body>
          {error ? (
            <LoadingError onRetry={handleRefetchProjectStats} />
          ) : (
            <LoadingIndicator />
          )}
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
              {error ? (
                <Button
                  priority="primary"
                  title={t('There was an error loading data')}
                  disabled
                >
                  {t('Done')}
                </Button>
              ) : (
                <Placeholder height="40px" width="80px" />
              )}
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
        specifiedClientRate={specifiedClientRate}
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
            'Set a server-side sample rate for all transactions using our suggestion as a starting point. To improve the accuracy of your performance metrics, we also suggest increasing your client(SDK) sample rate to allow more transactions to be processed. [learnMoreLink: Learn more about quota management].',
            {
              learnMoreLink: (
                <ExternalLink
                  href={`${SERVER_SIDE_SAMPLING_DOC_LINK}getting-started/#2-set-a-uniform-sample-rate`}
                />
              ),
            }
          )}
        </TextBlock>
        <Fragment>
          <UniformRateChart
            series={
              selectedStrategy === Strategy.CURRENT
                ? projectStatsToSeries(projectStats30d.data, specifiedClientRate)
                : projectStatsToPredictedSeries(
                    projectStats30d.data,
                    client,
                    server,
                    specifiedClientRate
                  )
            }
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
                {isEdited && !isValidSampleRate(client) ? (
                  <Tooltip
                    title={t('Set a value between 0 and 100')}
                    containerDisplayMode="inline-flex"
                  >
                    <IconWarning
                      color="errorText"
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
                {isEdited && !isValidSampleRate(server) ? (
                  <Tooltip
                    title={t('Set a value between 0 and 100')}
                    containerDisplayMode="inline-flex"
                  >
                    <IconWarning
                      color="errorText"
                      size="sm"
                      data-test-id="invalid-server-rate"
                    />
                  </Tooltip>
                ) : (
                  isServerRateHigherThanClientRate && (
                    <Tooltip
                      title={t(
                        'Server sample rate shall not be higher than client sample rate'
                      )}
                      containerDisplayMode="inline-flex"
                    >
                      <IconWarning
                        color="errorText"
                        size="sm"
                        data-test-id="invalid-server-rate"
                      />
                    </Tooltip>
                  )
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

          {!isWithoutTransactions && shouldUseConservativeSampleRate && (
            <Alert type="info" showIcon>
              {t(
                "For accurate suggestions, we need at least 48hrs to ingest transactions. Meanwhile, here's a conservative server-side sampling rate which can be changed later on."
              )}
            </Alert>
          )}

          <AffectOtherProjectsTransactionsAlert
            affectedProjects={affectedProjects}
            projectSlug={project.slug}
            isProjectIncompatible={isProjectIncompatible}
          />
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
              disabled={
                saving ||
                !isValid ||
                selectedStrategy === Strategy.CURRENT ||
                isProjectIncompatible ||
                isWithoutTransactions
              }
              title={
                isProjectIncompatible
                  ? t('Your project is currently incompatible with Dynamic Sampling.')
                  : isWithoutTransactions
                  ? t('You need at least one transaction to set up Dynamic Sampling.')
                  : selectedStrategy === Strategy.CURRENT
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

export const Projects = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1.5)};
  justify-content: flex-start;
  margin-top: ${space(1)};
`;
