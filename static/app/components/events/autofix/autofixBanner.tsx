import {Fragment} from 'react';
import styled from '@emotion/styled';

import bannerBackground from 'sentry-images/spot/ai-suggestion-banner-background.svg';
import bannerSentaur from 'sentry-images/spot/ai-suggestion-banner-sentaur.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {AutofixContextModal} from 'sentry/components/events/autofix/autofixContextModal';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

type Props = {
  triggerAutofix: (value: string) => void;
};

export function AutofixBanner({triggerAutofix}: Props) {
  const isSentryEmployee = useIsSentryEmployee();
  const onClickAdditionalContext = () => {
    openModal(deps => <AutofixContextModal {...deps} triggerAutofix={triggerAutofix} />);
  };

  return (
    <Wrapper>
      <IllustrationContainer>
        <Background src={bannerBackground} />
        <Stars src={bannerStars} />
        <Sentaur src={bannerSentaur} />
      </IllustrationContainer>
      <Body>
        <div>
          <Title>{t('Try Autofix')}</Title>
          <SubTitle>{t('You might get lucky, but then again, maybe not...')}</SubTitle>
        </div>
        <ContextArea>
          <Button onClick={() => triggerAutofix('')} size="sm">
            {t('Gimme Fix')}
          </Button>
          <Button onClick={onClickAdditionalContext} size="sm">
            {t('Start With Some Context')}
          </Button>
        </ContextArea>
        {isSentryEmployee && (
          <Fragment>
            <Separator />
            <PiiMessage>
              {t(
                'By clicking the button above, you confirm that there is no PII in this event.'
              )}
            </PiiMessage>
          </Fragment>
        )}
      </Body>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  margin-bottom: 0;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;

const Body = styled(PanelBody)`
  padding: ${space(2)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    max-width: calc(100% - 400px);
  }
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const SubTitle = styled('p')`
  margin: ${space(1)} 0;
`;

const ContextArea = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const IllustrationContainer = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    position: absolute;
    bottom: 0;
    right: 0;
    top: 0;
    width: 400px;
    overflow: hidden;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  }
`;

const Sentaur = styled('img')`
  height: 125px;
  position: absolute;
  bottom: 0;
  right: 185px;
  z-index: 1;
  pointer-events: none;
`;

const Background = styled('img')`
  position: absolute;
  bottom: 0;
  right: 0;
  max-width: 100%;
`;

const Stars = styled('img')`
  pointer-events: none;
  position: absolute;
  right: -140px;
  bottom: 40px;
  height: 120px;
`;

const Separator = styled('hr')`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
  border-color: ${p => p.theme.translucentBorder};
`;

const PiiMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
