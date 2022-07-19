import 'prism-sentry/index.css';

import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  OutdatedVersion,
  SdkOutdatedVersion,
  SdkProjectBadge,
  UpdatesList,
} from 'sentry/components/sidebar/broadcastSdkUpdates';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {
  RecommendedSdkUpgrade,
  SamplingRule,
  UniformModalsSubmit,
} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatPercentage} from 'sentry/utils/formatters';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {isValidSampleRate, SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';
import {projectStatsToSampleRates} from '../utils/projectStatsToSampleRates';
import useProjectStats from '../utils/useProjectStats';

import {FooterActions, Stepper} from './uniformRateModal';

export type RecommendedStepsModalProps = ModalRenderProps & {
  onReadDocs: () => void;
  organization: Organization;
  projectId: Project['id'];
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
  clientSampleRate?: number;
  onGoBack?: () => void;
  onSubmit?: UniformModalsSubmit;
  recommendedSampleRate?: boolean;
  serverSampleRate?: number;
  uniformRule?: SamplingRule;
};

export function RecommendedStepsModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  recommendedSdkUpgrades,
  onGoBack,
  onReadDocs,
  onSubmit,
  clientSampleRate,
  serverSampleRate,
  uniformRule,
  projectId,
  recommendedSampleRate,
}: RecommendedStepsModalProps) {
  const [saving, setSaving] = useState(false);
  const {projectStats} = useProjectStats({
    orgSlug: organization.slug,
    projectId,
    interval: '1h',
    statsPeriod: '48h',
    disable: !!clientSampleRate,
  });
  const {maxSafeSampleRate} = projectStatsToSampleRates(projectStats);
  const suggestedClientSampleRate = clientSampleRate ?? maxSafeSampleRate;

  const isValid =
    isValidSampleRate(clientSampleRate) && isValidSampleRate(serverSampleRate);

  function handleDone() {
    if (!onSubmit) {
      closeModal();
    }

    if (!isValid) {
      return;
    }

    setSaving(true);

    onSubmit?.({
      recommendedSampleRate: recommendedSampleRate ?? false, // the recommendedSampleRate prop will always be available in the wizard modal
      uniformRateModalOrigin: false,
      sampleRate: serverSampleRate!,
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

  function handleGoBack() {
    if (!onGoBack) {
      return;
    }

    trackAdvancedAnalyticsEvent('sampling.settings.modal.recommended.next.steps_back', {
      organization: organization.slug,
      project_id: projectId,
    });

    onGoBack();
  }

  function handleReadDocs() {
    trackAdvancedAnalyticsEvent(
      'sampling.settings.modal.recommended.next.steps_read_docs',
      {
        organization: organization.slug,
        project_id: projectId,
      }
    );

    onReadDocs();
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Recommended next steps\u2026')}</h4>
      </Header>
      <Body>
        <List symbol="colored-numeric">
          {!!recommendedSdkUpgrades.length && (
            <ListItem>
              <h5>{t('Update the following SDK versions')}</h5>
              <TextBlock>
                {tct(
                  "I know what you're thinking, [italic:“[strong:It's already working, why should I?]”]. By updating the following SDK's before activating any server sampling rules, you're avoiding situations when our servers aren't accepting enough transactions ([doubleSamplingLink:double sampling]) or our servers are accepting too many transactions ([exceededQuotaLink:exceeded quota]).",
                  {
                    strong: <strong />,
                    italic: <i />,
                    doubleSamplingLink: <ExternalLink href="" />,
                    exceededQuotaLink: <ExternalLink href="" />,
                  }
                )}
              </TextBlock>
              <UpgradeSDKfromProjects>
                {recommendedSdkUpgrades.map(
                  ({project: upgradableProject, latestSDKName, latestSDKVersion}) => {
                    return (
                      <div key={upgradableProject.id}>
                        <SdkProjectBadge
                          project={upgradableProject}
                          organization={organization}
                        />
                        <SdkOutdatedVersion>
                          {tct('This project is on [current-version]', {
                            ['current-version']: (
                              <OutdatedVersion>{`${latestSDKName}@v${latestSDKVersion}`}</OutdatedVersion>
                            ),
                          })}
                        </SdkOutdatedVersion>
                      </div>
                    );
                  }
                )}
              </UpgradeSDKfromProjects>
            </ListItem>
          )}
          <ListItem>
            <h5>{t('Increase your SDK Transaction sample rate')}</h5>
            <TextBlock>
              {t(
                'This comes in handy when server-side sampling target the transactions you want to accept, but you need more of those transactions being sent by your client. Here we  already suggest a value based on your quota and throughput.'
              )}
            </TextBlock>
            <div>
              <pre className="language-javascript highlight">
                <code className="language-javascript">
                  Sentry
                  <span className="token punctuation">.</span>
                  <span className="token function">init</span>
                  <span className="token punctuation">(</span>
                  <span className="token punctuation">{'{'}</span>
                  <br />
                  <span className="token punctuation">{'  ...'}</span>
                  <br />
                  <span className="token literal-property property">
                    {'  traceSampleRate'}
                  </span>
                  <span className="token operator">:</span>{' '}
                  <span className="token string">{suggestedClientSampleRate || ''}</span>
                  <span className="token punctuation">,</span>{' '}
                  <span className="token comment">
                    //{' '}
                    {suggestedClientSampleRate
                      ? formatPercentage(suggestedClientSampleRate)
                      : ''}
                  </span>
                  <br />
                  <span className="token punctuation">{'}'}</span>
                  <span className="token punctuation">)</span>
                  <span className="token punctuation">;</span>
                </code>
              </pre>
            </div>
          </ListItem>
        </List>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} onClick={handleReadDocs} external>
            {t('Read Docs')}
          </Button>
          <ButtonBar gap={1}>
            {onGoBack && (
              <Fragment>
                <Stepper>{t('Step 2 of 2')}</Stepper>
                <Button onClick={handleGoBack}>{t('Back')}</Button>
              </Fragment>
            )}
            {!onGoBack && <Button onClick={closeModal}>{t('Cancel')}</Button>}
            <Button
              priority="primary"
              onClick={handleDone}
              disabled={onSubmit ? saving || !isValid : false} // do not disable the button if there's on onSubmit handler (modal was opened from the sdk alert)
              title={
                onSubmit
                  ? !isValid
                    ? t('Sample rate is not valid')
                    : undefined
                  : undefined
              }
            >
              {t('Done')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const UpgradeSDKfromProjects = styled(UpdatesList)`
  margin-top: 0;
  margin-bottom: ${space(3)};
`;
