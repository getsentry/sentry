import {useRef} from 'react';
import styled from '@emotion/styled';

import bannerImage from 'sentry-images/spot/ai-suggestion-banner.svg';

import {openModal} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import {AutofixSetupModal} from 'sentry/components/events/autofix/autofixSetupModal';
import useDrawer from 'sentry/components/globalDrawer';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {SolutionsHubDrawer} from 'sentry/views/issueDetails/streamline/solutionsHubDrawer';

type Props = {
  event: Event;
  group: Group;
  hasSuccessfulSetup: boolean;
  project: Project;
};

function SuccessfulSetup({
  group,
  project,
  event,
}: Pick<Props, 'group' | 'project' | 'event'>) {
  const {openDrawer, isDrawerOpen, closeDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const openAutofix = () => {
    if (!isDrawerOpen) {
      openDrawer(
        () => <SolutionsHubDrawer group={group} project={project} event={event} />,
        {
          ariaLabel: t('Autofix drawer'),
          // We prevent a click on the Open/Close Autofix button from closing the drawer so that
          // we don't reopen it immediately, and instead let the button handle this itself.
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = openButtonRef.current;
            if (
              viewAllButton?.contains(element) ||
              document.getElementById('sentry-feedback')?.contains(element)
            ) {
              return false;
            }
            return true;
          },
          transitionProps: {stiffness: 1000},
        }
      );
    } else {
      closeDrawer();
    }
  };

  if (isDrawerOpen) {
    return (
      <Button onClick={() => openAutofix()} size="sm" ref={openButtonRef}>
        {t('Open Autofix')}
      </Button>
    );
  }

  return (
    <Button
      onClick={() => openAutofix()}
      size="sm"
      ref={openButtonRef}
      analyticsEventKey="autofix.open_drawer_clicked"
      analyticsEventName="Autofix: Open Drawer Clicked"
      analyticsParams={{group_id: group.id}}
    >
      {t('Open Autofix')}
    </Button>
  );
}

function AutofixBannerContent({group, hasSuccessfulSetup, project, event}: Props) {
  if (hasSuccessfulSetup) {
    return <SuccessfulSetup group={group} project={project} event={event} />;
  }

  return (
    <Button
      analyticsEventKey="autofix.setup_clicked"
      analyticsEventName="Autofix: Setup Clicked"
      analyticsParams={{group_id: group.id}}
      onClick={() => {
        openModal(deps => (
          <AutofixSetupModal {...deps} groupId={group.id} projectId={project.id} />
        ));
      }}
      size="sm"
    >
      Set up Autofix
    </Button>
  );
}

export function AutofixBanner({group, project, event, hasSuccessfulSetup}: Props) {
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
            group={group}
            project={project}
            event={event}
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
  padding: ${space(2)} ${space(3)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const SubTitle = styled('p')`
  margin: ${space(1)} 0;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(1)};
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
  margin-top: ${space(1.5)};
`;
