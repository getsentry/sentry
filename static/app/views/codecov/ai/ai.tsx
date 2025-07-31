import styled from '@emotion/styled';

import preventAiIllustration from 'sentry-images/prevent-ai-illustration.svg';

import {ExternalLink} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function AIPage() {
  return (
    <OnboardingPanel>
      <Container>
        <ImageColumn>
          <IllustrationImage src={preventAiIllustration} alt="PreventAI illustration" />
        </ImageColumn>
        <TextColumn>
          <Title>{t('Ship Code That Breaks Less With Code Reviews And Tests')}</Title>
          <Description>
            {t('Prevent AI is a generative AI agent that automates tasks in your PR:')}
          </Description>
          <List>
            <ListItem>
              {t(
                'It reviews your pull request, predicting errors and suggesting code fixes.'
              )}
            </ListItem>
            <ListItem>
              {t('It generates unit tests for untested code in your PR.')}
            </ListItem>
          </List>
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/">
            {t('Learn more')}
          </ExternalLink>
        </TextColumn>
      </Container>
    </OnboardingPanel>
  );
}

const OnboardingPanel = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
  position: relative;
`;

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    min-height: 350px;
  }
`;

const ImageColumn = styled('div')`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const TextColumn = styled('div')`
  min-width: 0;
  z-index: 1;
  max-width: 600px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    flex: 2;
  }
`;

const IllustrationImage = styled('img')`
  width: 227px;
  height: 157px;
  object-fit: contain;
  max-width: 100%;
`;

const Title = styled('h3')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize['2xl']};
  line-height: 1.33;
  color: ${p => p.theme.headingColor};
  margin: 0 0 ${space(2)} 0;
  text-transform: capitalize;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
    text-align: center;
  }
`;

const Description = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.43;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(1)} 0;
`;
