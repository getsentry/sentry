import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import {PlatformIcon} from 'platformicons';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import type {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import PlatformPicker, {
  type Category,
  type Platform,
} from 'sentry/components/platformPicker';
import TeamSelector from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import slugify from 'sentry/utils/slugify';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {IssueAlertFragment} from 'sentry/views/projectInstall/createProject';
import IssueAlertOptions from 'sentry/views/projectInstall/issueAlertOptions';

type Props = ModalRenderProps & {
  defaultCategory?: Category;
};

export default function ProjectCreationModal({
  Header,
  closeModal,
  defaultCategory,
}: Props) {
  const [platform, setPlatform] = useState<OnboardingSelectedSDK | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [alertRuleConfig, setAlertRuleConfig] = useState<IssueAlertFragment | undefined>(
    undefined
  );
  const [projectName, setProjectName] = useState('');
  const [team, setTeam] = useState<Team | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const api = useApi();
  const organization = useOrganization();

  function handlePlatformChange(selectedPlatform: Platform | null) {
    if (selectedPlatform) {
      setPlatform({
        ...omit(selectedPlatform, 'id'),
        key: selectedPlatform.id,
      });
    }
  }

  const createProject = useCallback(async () => {
    const {slug} = organization;
    const {
      shouldCreateCustomRule,
      name,
      conditions,
      actions,
      actionMatch,
      frequency,
      defaultRules,
    } = alertRuleConfig || {};

    if (platform === undefined) {
      return;
    }

    addLoadingMessage(t('Creating project...'), {
      duration: 15000,
    });

    try {
      const url = `/teams/${slug}/${team}/projects/`;
      const projectData = await api.requestPromise(url, {
        method: 'POST',
        data: {
          name: projectName,
          platform: platform.key,
          default_rules: defaultRules ?? true,
          origin: 'ui',
        },
      });

      let ruleId: string | undefined;
      if (shouldCreateCustomRule) {
        const ruleData = await api.requestPromise(
          `/projects/${organization.slug}/${projectData.slug}/rules/`,
          {
            method: 'POST',
            data: {
              name,
              conditions,
              actions,
              actionMatch,
              frequency,
            },
          }
        );
        ruleId = ruleData.id;
      }

      ProjectsStore.onCreateSuccess(projectData, organization.slug);
      clearIndicators();
      trackAnalytics('project_modal.created', {
        organization,
        issue_alert: defaultRules
          ? 'Default'
          : shouldCreateCustomRule
            ? 'Custom'
            : 'No Rule',
        project_id: projectData.id,
        rule_id: ruleId || '',
      });

      addSuccessMessage(`Created project ${projectData.slug}`);
      closeModal();
    } catch (err) {
      setCreating(false);
      addErrorMessage(`Failed to create project ${projectName}`);
    }
  }, [api, alertRuleConfig, organization, platform, projectName, team, closeModal]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Create a Project')}</h4>
      </Header>
      {step === 0 && (
        <Fragment>
          <Subtitle>Choose a Platform</Subtitle>
          <PlatformPicker
            defaultCategory={defaultCategory}
            setPlatform={handlePlatformChange}
            organization={organization}
            platform={platform?.key}
            showFilterBar={false}
            navClassName="centered"
            listClassName="centered"
          />
        </Fragment>
      )}
      {step === 1 && (
        <Fragment>
          <Subtitle>{t('Set your alert frequency')}</Subtitle>
          <IssueAlertOptions
            platformLanguage={platform?.language as SupportedLanguages}
            onChange={updatedData => setAlertRuleConfig(updatedData)}
          />
          <Subtitle>{t('Name your project and assign it a team')}</Subtitle>
          <ProjectNameTeamSection>
            <div>
              <Label>{t('Project name')}</Label>
              <ProjectNameInputWrap>
                <StyledPlatformIcon platform={platform?.key ?? 'other'} size={20} />
                <ProjectNameInput
                  type="text"
                  name="project-name"
                  placeholder={t('project-name')}
                  autoComplete="off"
                  value={projectName}
                  onChange={e => setProjectName(slugify(e.target.value))}
                />
              </ProjectNameInputWrap>
            </div>
            <div>
              <Label>{t('Team')}</Label>
              <TeamInput
                allowCreate
                name="select-team"
                aria-label={t('Select a Team')}
                menuPlacement="auto"
                clearable={false}
                value={team}
                placeholder={t('Select a Team')}
                onChange={(choice: any) => setTeam(choice.value)}
                teamFilter={(tm: Team) => tm.access.includes('team:admin')}
              />
            </div>
          </ProjectNameTeamSection>
        </Fragment>
      )}
      <Footer>
        {step === 1 && <Button onClick={() => setStep(step - 1)}>{t('Back')}</Button>}
        {step === 0 && (
          <Button
            priority="primary"
            disabled={!platform}
            onClick={() => setStep(step + 1)}
          >
            {t('Next Step')}
          </Button>
        )}
        {step === 1 && (
          <Button
            priority="primary"
            onClick={() => {
              setCreating(true);
              createProject();
            }}
            disabled={!projectName || !team || !alertRuleConfig || !platform || creating}
          >
            {t('Create Project')}
          </Button>
        )}
      </Footer>
    </Fragment>
  );
}

const Footer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: right;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: 50%;
  left: ${p => p.theme.formPadding.md.paddingLeft}px;
  transform: translateY(-50%);
`;

const ProjectNameInputWrap = styled('div')`
  position: relative;
`;
const ProjectNameInput = styled(Input)`
  padding-left: calc(${p => p.theme.formPadding.md.paddingLeft}px * 1.5 + 20px);
`;

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
`;

const ProjectNameTeamSection = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const TeamInput = styled(TeamSelector)`
  min-width: 250px;
`;

const Subtitle = styled('p')`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
`;
