import {Fragment} from 'react';
import styled from '@emotion/styled';

import bannerBackground from 'sentry-images/spot/ai-suggestion-banner-background.svg';
import bannerSentaur from 'sentry-images/spot/ai-suggestion-banner-sentaur.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {AutofixInstructionsModal} from 'sentry/components/events/autofix/autofixInstructionsModal';
import {AutofixCodebaseIndexingStatus} from 'sentry/components/events/autofix/types';
import {useAutofixCodebaseIndexing} from 'sentry/components/events/autofix/useAutofixCodebaseIndexing';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AutofixSetupModal} from 'sentry/components/modals/autofixSetupModal';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

type Props = {
  groupId: string;
  hasSuccessfulSetup: boolean;
  projectId: string;
  triggerAutofix: (value: string) => void;
};

export function AutofixBanner({
  groupId,
  projectId,
  triggerAutofix,
  hasSuccessfulSetup,
}: Props) {
  const isSentryEmployee = useIsSentryEmployee();
  const onClickGiveInstructions = () => {
    openModal(deps => (
      <AutofixInstructionsModal
        {...deps}
        triggerAutofix={triggerAutofix}
        groupId={groupId}
      />
    ));
  };
  const {status: indexingStatus} = useAutofixCodebaseIndexing({projectId, groupId});

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
          {hasSuccessfulSetup ? (
            <Fragment>
              <Button
                onClick={() => triggerAutofix('')}
                size="sm"
                analyticsEventKey="autofix.start_fix_clicked"
                analyticsEventName="Autofix: Start Fix Clicked"
                analyticsParams={{group_id: groupId}}
              >
                {t('Gimme Fix')}
              </Button>
              <Button
                onClick={onClickGiveInstructions}
                size="sm"
                analyticsEventKey="autofix.give_instructions_clicked"
                analyticsEventName="Autofix: Give Instructions Clicked"
                analyticsParams={{group_id: groupId}}
              >
                {t('Give Instructions')}
              </Button>
            </Fragment>
          ) : indexingStatus === AutofixCodebaseIndexingStatus.INDEXING ? (
            <RowStack>
              <LoadingIndicator mini />
              <LoadingMessage>
                Indexing your repositories, hold tight this may take up to 30 minutes...
              </LoadingMessage>
            </RowStack>
          ) : (
            <Button
              analyticsEventKey="autofix.setup_clicked"
              analyticsEventName="Autofix: Setup Clicked"
              analyticsParams={{group_id: groupId}}
              onClick={() => {
                openModal(deps => (
                  <AutofixSetupModal {...deps} groupId={groupId} projectId={projectId} />
                ));
              }}
              size="sm"
            >
              Setup Autofix
            </Button>
          )}
        </ContextArea>
        {isSentryEmployee && hasSuccessfulSetup && (
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
  pointer-events: none;

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
  height: 110px;
  position: absolute;
  bottom: 0;
  right: 185px;
  z-index: 1;
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
  right: -120px;
  bottom: 40px;
  height: 90px;
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

const RowStack = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const LoadingMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
