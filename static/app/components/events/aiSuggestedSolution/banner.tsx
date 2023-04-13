import styled from '@emotion/styled';

import bannerBackground from 'sentry-images/spot/ai-suggestion-banner-background.svg';
import bannerSentaur from 'sentry-images/spot/ai-suggestion-banner-sentaur.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {Button} from 'sentry/components/button';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    height: 80px;
  }
`;

const Body = styled(PanelBody)`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 42% 1fr;
  }
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
  display: grid;
  grid-template-columns: max-content max-content;
  align-items: center;
  /* to be consistent with the feature badge size */
  line-height: ${space(2)};
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
    height: 8.563rem;
    position: absolute;
    bottom: 0;
    right: 6.608rem;
    object-fit: cover;
    z-index: 1;
  }
`;

const Background = styled('img')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    position: absolute;
    right: 1rem;
    top: 1.5rem;
  }
`;
