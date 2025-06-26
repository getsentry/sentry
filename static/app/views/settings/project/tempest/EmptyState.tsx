import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Button} from 'sentry/components/core/button';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export default function EmptyState() {
  const navigate = useNavigate();
  const location = useLocation();

  const {data: ipAddresses, isPending} = useApiQuery<string>(
    [
      '/tempest-ips/',
      {
        headers: {
          Accept: 'text/html, text/plain, */*',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  return (
    <div>
      <HeaderWrapper>
        <Title>{t('Get Started with PlayStation Error Monitoring')}</Title>
        <Description>
          {t('Your code sleuth eagerly awaits its first mission.')}
        </Description>
        <Image src={waitingForEventImg} />
      </HeaderWrapper>
      <Divider />
      <Body>
        <Setup>
          <BodyTitle>{t('Install instructions')}</BodyTitle>
          <GuidedSteps
            initialStep={decodeInteger(location.query.guidedStep)}
            onStepChange={step => {
              navigate({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  guidedStep: step,
                },
              });
            }}
          >
            <GuidedSteps.Step
              stepKey="step-1"
              title={t('Retrieve Back Office Server Credential from Sony')}
            >
              <DescriptionWrapper>
                {t(
                  'Retrieve the Back Office Server Credentials (Client ID and Secret) for the title of interest. To avoid problems with rate limiting it is preferred to have a separate set of credentials that are only used by Sentry.'
                )}
              </DescriptionWrapper>
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>

            <GuidedSteps.Step stepKey="step-2" title={t('Allow list our IP Addresses:')}>
              <DescriptionWrapper>
                {t(
                  'Allow list our Outbound IP addresses as they will be the once used for making the requests using the provided credentials'
                )}
                {isPending ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <CodeSnippetWrapper>
                    <OnboardingCodeSnippet>{ipAddresses || ''}</OnboardingCodeSnippet>
                  </CodeSnippetWrapper>
                )}
              </DescriptionWrapper>

              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>

            <GuidedSteps.Step
              stepKey="step-3"
              title={t('Configure data collection')}
              optional
            >
              <DescriptionWrapper>
                <p>
                  {t(
                    'You can toggle "Attach Dumps" in which case Sentry will add the prosperodumps as an attachment to the issues.'
                  )}
                  <br />
                  {t(
                    'You can toggle "Attach Screenshots" in which case Sentry will add the crash screenshot, if available, as an attachment to the issues. These screenshots are not PII stripped.'
                  )}
                </p>
                <p>
                  <BoldText>{t('Note:')}</BoldText>{' '}
                  {t(
                    'Both screenshots and crash dump files consume from your attachments quota.'
                  )}
                </p>
              </DescriptionWrapper>
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>

            <GuidedSteps.Step stepKey="step-4" title={t('Look at events')}>
              <DescriptionWrapper>
                {t(
                  'Once you provided credentials, Sentry will make an initial request to verify the credentials are correct and the IPs are allowlisted, if either of these are not the case an error will be displayed in the UI. After that new crashes are pulled once every minute. Events generated from crashes can be filtered using:'
                )}{' '}
                <OnboardingCodeSnippet language="javascript">
                  os.name:PlayStation
                </OnboardingCodeSnippet>
              </DescriptionWrapper>
              <GuidedSteps.StepButtons>
                <Button
                  size="sm"
                  priority="primary"
                  onClick={() => {
                    navigate({
                      pathname: '/issues/',
                      query: {
                        query: 'os.name:PlayStation',
                      },
                    });
                  }}
                >
                  {t('Take me to Issues')}
                </Button>
              </GuidedSteps.StepButtons>
            </GuidedSteps.Step>
          </GuidedSteps>
        </Setup>
      </Body>
    </div>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')``;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')``;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const CodeSnippetWrapper = styled('div')`
  margin-bottom: ${space(2)};
  margin-top: ${space(2)};
`;

const DescriptionWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;

const BoldText = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;
