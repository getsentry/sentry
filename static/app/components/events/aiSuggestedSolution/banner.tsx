import styled from '@emotion/styled';

import bannerBackground from 'sentry-images/spot/ai-suggestion-banner-background.svg';
import bannerSentaur from 'sentry-images/spot/ai-suggestion-banner-sentaur.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {ExperimentalFeatureBadge} from './experimentalFeatureBadge';

type Props = {
  onViewSuggestion: () => void;
};

export function Banner({onViewSuggestion}: Props) {
  return (
    <Wrapper>
      <Body withPadding>
        <div>
          <Title>
            {t('AI Solutions')}
            <MoreInfoTooltip
              isHoverable
              size="sm"
              title={tct(
                'This is an OpenAI generated solution that suggests a fix for this issue. Be aware that this may not be accurate. [learnMore:Learn more]',
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
        </div>
        <Action>
          <Background src={bannerBackground} />
          <Stars src={bannerStars} />
          <Sentaur src={bannerSentaur} />
          <ViewSuggestionButton size="xs" onClick={onViewSuggestion}>
            {t('View Suggestion')}
          </ViewSuggestionButton>
        </Action>
      </Body>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  margin-bottom: 0;
  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    height: 80px;
  }
`;

const Body = styled(PanelBody)`
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
    border-radius: ${p => p.theme.panelBorderRadius};
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
