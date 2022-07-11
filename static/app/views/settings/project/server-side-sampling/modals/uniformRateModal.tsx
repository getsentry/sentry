import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {NumberField} from 'sentry/components/forms';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels';
import Radio from 'sentry/components/radio';
import {IconRefresh} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project, SeriesApi} from 'sentry/types';
import {SamplingRule, UniformModalsSubmit} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SamplingSDKAlert} from '../samplingSDKAlert';
import {isValidSampleRate, SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';
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

type Props = Omit<RecommendedStepsModalProps, 'onSubmit' | 'recommendedSdkUpgrades'> & {
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
  ...props
}: Props) {
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

  const uniformSampleRate = uniformRule?.sampleRate;

  const {trueSampleRate, maxSafeSampleRate} = projectStatsToSampleRates(projectStats);

  const currentClientSampling =
    defined(trueSampleRate) && !isNaN(trueSampleRate) ? trueSampleRate * 100 : undefined;
  const currentServerSampling =
    defined(uniformSampleRate) && !isNaN(uniformSampleRate)
      ? uniformSampleRate * 100
      : undefined;
  const recommendedClientSampling =
    defined(maxSafeSampleRate) && !isNaN(maxSafeSampleRate)
      ? maxSafeSampleRate * 100
      : undefined;
  const recommendedServerSampling = currentClientSampling;

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>(Strategy.CURRENT);
  const [client, setClient] = useState(recommendedClientSampling);
  const [server, setServer] = useState(recommendedServerSampling);

  const [saving, setSaving] = useState(false);

  const shouldHaveNextStep =
    client !== currentClientSampling || recommendedSdkUpgrades.length > 0;

  useEffect(() => {
    setClient(recommendedClientSampling);
    setServer(recommendedServerSampling);
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
      setActiveStep(Step.RECOMMENDED_STEPS);
      return;
    }

    setSaving(true);

    onSubmit(
      server!,
      uniformRule,
      () => {
        setSaving(false);
        closeModal();
      },
      () => {
        setSaving(false);
      }
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
        clientSampleRate={client}
        serverSampleRate={server}
        uniformRule={uniformRule}
      />
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Set a uniform sample rate for Transactions')}</h4>
      </Header>
      <Body>
        <TextBlock>
          {tct(
            'Similarly to how you would configure a [transactionSampleRate: Transaction Sample Rate] from within your client’s [sentryInit: Sentry.init()], we ask you to [uniformRate: set a uniform sample rate] which provides an even cross-section of transactions from [allProjects: all projects].',
            {
              transactionSampleRate: <strong />,
              sentryInit: <strong />,
              uniformRate: <strong />,
              allProjects: <strong />,
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
                  : projectStatsToPredictedSeries(
                      projectStats30d,
                      client ? Math.max(Math.min(client / 100, 1), 0) : undefined, // clamping between 0-1
                      server ? Math.max(Math.min(server / 100, 1), 0) : undefined
                    )
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
                    ? formatPercentage(currentClientSampling / 100)
                    : 'N/A'}
                </RightAligned>
                <RightAligned>
                  {defined(currentServerSampling)
                    ? formatPercentage(currentServerSampling / 100)
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
                  {isEdited ? t('New') : t('Recommended')}
                </Label>
                <RightAligned>
                  <StyledNumberField
                    name="recommended-client-sampling"
                    placeholder="%"
                    value={client}
                    onChange={value => {
                      setClient(value);
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
                    value={server}
                    onChange={value => {
                      setServer(value);
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
                      aria-label={t('Reset to recommended values')}
                      onClick={() => {
                        setClient(recommendedClientSampling);
                        setServer(recommendedServerSampling);
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
              project={project}
              rules={rules}
              recommendedSdkUpgrades={recommendedSdkUpgrades}
              showLinkToTheModal={false}
            />
          </Fragment>
        )}
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} external>
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
