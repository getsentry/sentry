import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {openCreateOwnershipRule} from 'app/actionCreators/modal';
import Access from 'app/components/acl/access';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import FeatureBadge from 'app/components/featureBadge';
import Hovercard from 'app/components/hovercard';
import {Panel} from 'app/components/panels';
import {IconClose, IconQuestion} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CodeOwner, Organization, Project} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

import SidebarSection from '../sidebarSection';

type Props = {
  project: Project;
  organization: Organization;
  issueId: string;
  codeowners: CodeOwner[];
  handleCTAClose: () => void;
  isDismissed: boolean;
};

const OwnershipRules = ({
  project,
  organization,
  issueId,
  codeowners,
  isDismissed,
  handleCTAClose,
}: Props) => {
  const handleOpenCreateOwnershipRule = () => {
    openCreateOwnershipRule({project, organization, issueId});
  };
  const showCTA =
    organization.features.includes('integrations-codeowners') &&
    !codeowners.length &&
    !isDismissed;

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
    <Container dashedBorder>
      <HeaderContainer>
        <Header>{t('Codeowners sync')}</Header> <FeatureBadge type="beta" noTooltip />
        <DismissButton
          icon={<IconClose size="xs" />}
          priority="link"
          onClick={() => handleCTAClose()}
        />
      </HeaderContainer>
      <Content>
        {t(
          'Import GitHub or GitLab CODEOWNERS files to automatically assign issues to the right people.'
        )}
      </Content>
      <ButtonBar gap={1}>
        <SetupButton
          size="small"
          priority="primary"
          href={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
          onClick={() =>
            trackIntegrationEvent('integrations.code_owners_cta_setup_clicked', {
              view: 'stacktrace_issue_details',
              project_id: project.id,
              organization,
            })
          }
        >
          {t('Set It Up')}
        </SetupButton>
        <Button
          size="small"
          external
          href="https://docs.sentry.io/product/issues/issue-owners/#code-owners"
          onClick={() =>
            trackIntegrationEvent('integrations.code_owners_cta_docs_clicked', {
              view: 'stacktrace_issue_details',
              project_id: project.id,
              organization,
            })
          }
        >
          {t('Read Docs')}
        </Button>
      </ButtonBar>
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

const Container = styled(Panel)`
  background: none;
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
`;

const HeaderContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  align-items: flex-start;
`;

const Header = styled('h4')`
  margin-bottom: ${space(1)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Content = styled('span')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(2)};
`;

const SetupButton = styled(Button)`
  &:focus {
    color: ${p => p.theme.white};
  }
`;

const DismissButton = styled(Button)`
  justify-self: flex-end;
  color: ${p => p.theme.gray400};
`;
