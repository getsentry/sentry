import {Fragment} from 'react';
import styled from '@emotion/styled';

import bannerImage from 'sentry-images/spot/ai-suggestion-banner.svg';

import {openModal} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {AutofixInstructionsModal} from 'sentry/components/events/autofix/autofixInstructionsModal';
import {AutofixSetupModal} from 'sentry/components/events/autofix/autofixSetupModal';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

type Props = {
  groupId: string;
  hasSuccessfulSetup: boolean;
  projectId: string;
  triggerAutofix: (value: string) => void;
};

function SuccessfulSetup({
  groupId,
  triggerAutofix,
}: Pick<Props, 'groupId' | 'triggerAutofix'>) {
  const onClickGiveInstructions = () => {
    openModal(deps => (
      <AutofixInstructionsModal
        {...deps}
        triggerAutofix={triggerAutofix}
        groupId={groupId}
      />
    ));
  };

  return (
    <Fragment>
      <Button
        onClick={() => triggerAutofix('')}
        size="sm"
        analyticsEventKey="autofix.start_fix_clicked"
        analyticsEventName="Autofix: Start Fix Clicked"
        analyticsParams={{group_id: groupId}}
      >
        {t('Get root causes')}
      </Button>
      <Button
        onClick={onClickGiveInstructions}
        size="sm"
        analyticsEventKey="autofix.give_instructions_clicked"
        analyticsEventName="Autofix: Give Instructions Clicked"
        analyticsParams={{group_id: groupId}}
      >
        {t('Provide context first')}
      </Button>
    </Fragment>
  );
}

function AutofixBannerContent({
  groupId,
  triggerAutofix,
  hasSuccessfulSetup,
  projectId,
}: Props) {
  if (hasSuccessfulSetup) {
    return <SuccessfulSetup groupId={groupId} triggerAutofix={triggerAutofix} />;
  }

  return (
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
      Set up Autofix
    </Button>
  );
}

export function AutofixBanner({
  groupId,
  projectId,
  triggerAutofix,
  hasSuccessfulSetup,
}: Props) {
  const isSentryEmployee = useIsSentryEmployee();

  return (
    <Wrapper>
      <Body>
        <div>
          <Title>
            {t('Try Autofix')}
            <FeatureBadge
              type="experimental"
              title={tct(
                'This feature is experimental. Try it out and let us know your feedback at [email:autofix@sentry.io].',
                {
                  email: <a href="mailto:autofix@sentry.io" />,
                }
              )}
              tooltipProps={{isHoverable: true}}
            />
          </Title>
          <SubTitle>
            {t('Sit back and let Autofix find potential root causes and fixes')}
          </SubTitle>
        </div>
        <ButtonGroup>
          <AutofixBannerContent
            groupId={groupId}
            projectId={projectId}
            triggerAutofix={triggerAutofix}
            hasSuccessfulSetup={hasSuccessfulSetup}
          />
        </ButtonGroup>
        {isSentryEmployee && hasSuccessfulSetup && (
          <PiiMessage>
            {t(
              'By clicking the button above, you confirm that there is no PII in this event.'
            )}
          </PiiMessage>
        )}
      </Body>
      <IllustrationContainer>
        <Illustration src={bannerImage} />
      </IllustrationContainer>
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  display: flex;
  margin-bottom: 0;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;

const Body = styled(PanelBody)`
  display: flex;
  flex-direction: column;
  flex-grow: 2;
  padding: ${p => p.theme.space(2)} ${p => p.theme.space(3)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${p => p.theme.space(1)};
`;

const SubTitle = styled('p')`
  margin: ${p => p.theme.space(1)} 0;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(1)};
  margin-top: ${p => p.theme.space(1)};
`;

const IllustrationContainer = styled('div')`
  display: none;
  pointer-events: none;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: flex;
    align-items: flex-end;
  }
`;

const Illustration = styled('img')`
  height: 110px;
`;

const PiiMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${p => p.theme.space(1.5)};
`;
