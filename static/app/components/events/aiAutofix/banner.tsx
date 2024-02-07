import {useState} from 'react';
import styled from '@emotion/styled';

import bannerBackground from 'sentry-images/spot/ai-suggestion-banner-background.svg';
import bannerSentaur from 'sentry-images/spot/ai-suggestion-banner-sentaur.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextArea from 'sentry/components/forms/controls/textarea';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {ExperimentalFeatureBadge} from '../aiSuggestedSolution/experimentalFeatureBadge';

type Props = {
  additionalContext: string;
  onButtonClick: () => void;
  setAdditionalContext: (value: string) => void;
};

export function Banner({onButtonClick, additionalContext, setAdditionalContext}: Props) {
  const isSentryEmployee = useIsSentryEmployee();
  const [piiCertified, setPiiCertified] = useState(false);

  const showPiiMessage = isSentryEmployee && !piiCertified;

  return (
    <Wrapper>
      <Body>
        <Header>
          <TitleContent>
            <Title>
              {t('AI Autofix')}
              <MoreInfoTooltip
                isHoverable
                size="sm"
                title={tct(
                  'This is an OpenAI generated solution that automatically creates a pull request for this issue. Be aware that this may not be accurate. [learnMore:Learn more]',
                  {
                    learnMore: (
                      <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/ai-suggested-solution/" />
                    ),
                  }
                )}
              />
              <ExperimentalFeatureBadge />
            </Title>
            <Description>
              {t('You might get lucky, but again, maybe not\u2026')}
            </Description>
          </TitleContent>
          <Action>
            <Background src={bannerBackground} />
            <Stars src={bannerStars} />
            <Sentaur src={bannerSentaur} />
            <ViewSuggestionButton
              size="xs"
              onClick={onButtonClick}
              disabled={showPiiMessage}
            >
              {t('Try your luck')}
            </ViewSuggestionButton>
          </Action>
        </Header>
        {showPiiMessage ? (
          <PiiArea>
            <EmptyMessage
              icon={<IconFlag size="xl" />}
              title={t('PII Certification Required')}
              description={t(
                'Before using this feature, please confirm that there is no personally identifiable information in this event.'
              )}
              action={
                <ButtonBar gap={2}>
                  <Button priority="primary" onClick={() => setPiiCertified(true)}>
                    {t('Certify No PII')}
                  </Button>
                </ButtonBar>
              }
            />
          </PiiArea>
        ) : (
          <AdditionalContextArea>
            <AdditionalContextLabel>
              {t('Additional Context (Optional)')}
            </AdditionalContextLabel>
            <StyledTextArea
              value={additionalContext}
              placeholder={t(
                'Add additional context to help the AI find a better solution'
              )}
              onChange={e => setAdditionalContext(e.target.value)}
            />
          </AdditionalContextArea>
        )}
      </Body>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  margin-bottom: 0;
`;

const Body = styled(PanelBody)`
  display: flex;
  flex-direction: column;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(1)};

  > *:first-child {
    flex: 1;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: grid;
    grid-template-columns: 42% 1fr;
    height: 80px;
    position: relative;
  }
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  /* to be consistent with the feature badge size */
  height: ${space(2)};
  line-height: ${space(2)};
  white-space: nowrap;
`;

const TitleContent = styled('div')`
  display: flex;
  flex-direction: column;
  padding-left: ${space(2)};
`;

const Description = styled(TextBlock)`
  margin: ${space(1)} 0 0 0;
`;

const Action = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const Sentaur = styled('img')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    height: 8.563rem;
    position: absolute;
    bottom: 0;
    right: 6.608rem;
    object-fit: cover;
    z-index: 1;
    pointer-events: none;
  }
`;

const Background = styled('img')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    position: absolute;
    top: 0;
    right: 0;
    object-fit: cover;
    max-width: 100%;
    height: 100%;
    border-top-right-radius: ${p => p.theme.panelBorderRadius};
  }
`;

const Stars = styled('img')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    height: 8.563rem;
    position: absolute;
    right: -1rem;
    bottom: -0.125rem;
    object-fit: cover;
    /* workaround to remove a  extra svg on the bottom right */
    border-radius: ${p => p.theme.panelBorderRadius};
  }
`;

const ViewSuggestionButton = styled(Button)`
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    position: absolute;
    right: 1rem;
    top: 1.5rem;
  }
`;

const MoreInfoTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

const AdditionalContextLabel = styled('label')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const PiiArea = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.panelBorderRadius};
`;

const AdditionalContextArea = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.panelBorderRadius};
`;

const StyledTextArea = styled(TextArea)`
  resize: vertical;
  min-height: 80px;
`;
