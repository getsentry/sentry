import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {openCreateOwnershipRule} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import {Hovercard} from 'sentry/components/hovercard';
import {Panel} from 'sentry/components/panels';
import {IconClose, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CodeOwner, Organization, Project} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

import SidebarSection from '../sidebarSection';

type Props = {
  codeowners: CodeOwner[];
  handleCTAClose: () => void;
  isDismissed: boolean;
  issueId: string;
  organization: Organization;
  project: Project;
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
  const showCTA = !codeowners.length && !isDismissed;

  const createRuleButton = (
    <Access access={['project:write']}>
      {({hasAccess}) => (
        <GuideAnchor target="owners" position="bottom" offset={space(3)}>
          <Button
            onClick={handleOpenCreateOwnershipRule}
            size="small"
            disabled={!hasAccess}
            title={t("You don't have permission to create ownership rules.")}
            tooltipProps={{disabled: hasAccess}}
          >
            {t('Create Ownership Rule')}
          </Button>
        </GuideAnchor>
      )}
    </Access>
  );

  const codeOwnersCTA = (
    <Container dashedBorder>
      <HeaderContainer>
        <Header>{t('Codeowners sync')}</Header>{' '}
        <FeatureBadge style={{top: -3}} type="new" noTooltip />
        <DismissButton
          icon={<IconClose size="xs" />}
          priority="link"
          onClick={() => handleCTAClose()}
          aria-label={t('Close')}
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
          to={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
          onClick={() =>
            trackIntegrationAnalytics('integrations.code_owners_cta_setup_clicked', {
              view: 'stacktrace_issue_details',
              project_id: project.id,
              organization,
            })
          }
        >
          {t('Setup')}
        </SetupButton>
        <Button
          size="small"
          external
          href="https://docs.sentry.io/product/issues/issue-owners/#code-owners"
          onClick={() =>
            trackIntegrationAnalytics('integrations.code_owners_cta_docs_clicked', {
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
                      external
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
                <StyledIconQuestion size="xs" color="gray200" />
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

const Header = styled('h6')`
  margin-bottom: ${space(1)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const Content = styled('span')`
  color: ${p => p.theme.textColor};
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
