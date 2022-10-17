import 'prism-sentry/index.css';

import {Fragment} from 'react';
import styled from '@emotion/styled';

import {closeModal, ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {
  OutdatedVersion,
  SdkOutdatedVersion,
  SdkProjectBadge,
  UpdatesList,
} from 'sentry/components/sidebar/broadcastSdkUpdates';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {RecommendedSdkUpgrade} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

export type RecommendedStepsModalProps = ModalRenderProps & {
  onReadDocs: () => void;
  organization: Organization;
  projectId: Project['id'];
  recommendedSdkUpgrades: RecommendedSdkUpgrade[];
};

export function RecommendedStepsModal({
  Header,
  Body,
  Footer,
  organization,
  recommendedSdkUpgrades,
  onReadDocs,
  projectId,
}: RecommendedStepsModalProps) {
  if (recommendedSdkUpgrades.length === 0) {
    return null;
  }

  function handleReadDocs() {
    trackAdvancedAnalyticsEvent(
      'sampling.settings.modal.recommended.next.steps_read_docs',
      {
        organization,
        project_id: projectId,
      }
    );

    onReadDocs();
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Important next steps')}</h4>
      </Header>
      <Body>
        <h5>{t('Update the following SDK versions')}</h5>
        <TextBlock>
          {t(
            'To activate Dynamic Sampling rules, it’s a requirement to update the following project SDK(s):'
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
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} onClick={handleReadDocs} external>
            {t('Read Docs')}
          </Button>
          <Button priority="primary" onClick={closeModal}>
            {t('Got it')}
          </Button>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const UpgradeSDKfromProjects = styled(UpdatesList)`
  margin-top: 0;
  margin-bottom: ${space(3)};
`;

const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;
