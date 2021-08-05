import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {openCreateOwnershipRule} from 'app/actionCreators/modal';
import Access from 'app/components/acl/access';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import {IconQuestion} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CodeOwner, Organization, Project} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

import SidebarSection from '../sidebarSection';

type Props = {
  project: Project;
  organization: Organization;
  issueId: string;
  codeowners: CodeOwner[];
};

const OwnershipRules = ({project, organization, issueId, codeowners}: Props) => {
  const handleOpenCreateOwnershipRule = () => {
    openCreateOwnershipRule({project, organization, issueId});
  };
  const showCTA =
    organization.features.includes('integrations-codeowners') && !codeowners.length;

  const createRuleButton = (
    <Access access={['project:write']}>
      <GuideAnchor target="owners" position="bottom" offset={space(3)}>
        <Button onClick={handleOpenCreateOwnershipRule} size="small">
          {t('Create Ownership Rule')}
        </Button>
      </GuideAnchor>
    </Access>
  );

  const codeOwnersCTA = (
    <Container>
      <Header>{t('Sync your existing code owners')}</Header>
      <Content>
        {t(
          'Import your GitHub or GitLab CODEOWNERS file to start automatically assigning issues to the right people.'
        )}
      </Content>
      <Actions>
        <SetupButton
          size="small"
          priority="primary"
          href={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
          onClick={() =>
            trackAdvancedAnalyticsEvent('integrations.code_owners_cta_setup_clicked', {
              project_id: project.id,
              organization,
            })
          }
        >
          {t('Setup Now')}
        </SetupButton>
        <DocsButton
          size="small"
          target="_blank"
          href="https://docs.sentry.io/product/issues/issue-owners/#code-owners"
          onClick={() =>
            trackAdvancedAnalyticsEvent('integrations.code_owners_cta_docs_clicked', {
              project_id: project.id,
              organization,
            })
          }
        >
          {t('Read the docs')}
        </DocsButton>
      </Actions>
    </Container>
  );

  return (
    <SidebarSection
      title={
        <Fragment>
          {t('Ownership Rules')}
          <ClassNames>
            {({css}) => (
              <Hovercard
                body={
                  <HelpfulBody>
                    <p>
                      {t(
                        'Ownership rules allow you to associate file paths and URLs to specific teams or users, so alerts can be routed to the right people.'
                      )}
                    </p>
                    <Button
                      href="https://docs.sentry.io/workflow/issue-owners/"
                      priority="primary"
                    >
                      {t('Learn more')}
                    </Button>
                  </HelpfulBody>
                }
                containerClassName={css`
                  display: flex;
                  align-items: center;
                `}
              >
                <StyledIconQuestion size="xs" />
              </Hovercard>
            )}
          </ClassNames>
        </Fragment>
      }
    >
      {showCTA ? codeOwnersCTA : createRuleButton}
    </SidebarSection>
  );
};

export {OwnershipRules};

const StyledIconQuestion = styled(IconQuestion)`
  margin-left: ${space(0.5)};
`;

const HelpfulBody = styled('div')`
  padding: ${space(1)};
  text-align: center;
`;

const Container = styled('div')`
  width: 100%;
  height: 100%;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
`;

const Header = styled('h4')`
  margin-bottom: ${space(1)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Content = styled('span')`
  color: ${p => p.theme.gray400};
`;

const Actions = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const DocsButton = styled(Button)``;

const SetupButton = styled(Button)`
  &:focus {
    color: ${p => p.theme.white};
  }
`;
