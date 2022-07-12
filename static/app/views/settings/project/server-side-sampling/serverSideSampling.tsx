import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  fetchSamplingDistribution,
  fetchSamplingSdkVersions,
} from 'sentry/actionCreators/serverSideSampling';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {
  SamplingConditionOperator,
  SamplingRule,
  SamplingRuleOperator,
  SamplingRuleType,
} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {SpecificConditionsModal} from './modals/specificConditionsModal';
import {responsiveModal} from './modals/styles';
import {UniformRateModal} from './modals/uniformRateModal';
import useProjectStats from './utils/useProjectStats';
import {useRecommendedSdkUpgrades} from './utils/useRecommendedSdkUpgrades';
import {DraggableRuleList, DraggableRuleListUpdateItemsProps} from './draggableRuleList';
import {Promo} from './promo';
import {
  ActiveColumn,
  Column,
  ConditionColumn,
  GrabColumn,
  OperatorColumn,
  RateColumn,
  Rule,
} from './rule';
import {SamplingSDKAlert} from './samplingSDKAlert';
import {isUniformRule, SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = {
  project: Project;
};

export function ServerSideSampling({project}: Props) {
  const organization = useOrganization();
  const api = useApi();

  const hasAccess = organization.access.includes('project:write');
  const currentRules = project.dynamicSampling?.rules;
  const previousRules = usePrevious(currentRules);

  const [rules, setRules] = useState<SamplingRule[]>(currentRules ?? []);

  useEffect(() => {
    if (!isEqual(previousRules, currentRules)) {
      setRules(currentRules ?? []);
    }
  }, [currentRules, previousRules]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    async function fetchRecommendedSdkUpgrades() {
      await fetchSamplingDistribution({
        orgSlug: organization.slug,
        projSlug: project.slug,
        api,
      });

      await fetchSamplingSdkVersions({
        orgSlug: organization.slug,
        api,
      });
    }

    fetchRecommendedSdkUpgrades();
  }, [api, organization.slug, project.slug, hasAccess]);

  const {projectStats} = useProjectStats({
    orgSlug: organization.slug,
    projectId: project?.id,
    interval: '1h',
    statsPeriod: '48h',
  });

  const {recommendedSdkUpgrades} = useRecommendedSdkUpgrades({
    orgSlug: organization.slug,
  });

  async function handleActivateToggle(ruleId: SamplingRule['id']) {
    const newRules = rules.map(rule => {
      if (rule.id === ruleId) {
        return {
          ...rule,
          id: 0,
          active: !rule.active,
        };
      }
      return rule;
    });

    addLoadingMessage();
    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: newRules}},
        }
      );
      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully updated the sampling rule'));
    } catch (error) {
      const message = t('Unable to update the sampling rule');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  function handleGetStarted() {
    openModal(
      modalProps => (
        <UniformRateModal
          {...modalProps}
          organization={organization}
          project={project}
          projectStats={projectStats}
          rules={rules}
          onSubmit={saveUniformRule}
        />
      ),
      {
        modalCss: responsiveModal,
      }
    );
  }

  async function handleSortRules({
    overIndex,
    reorderedItems: ruleIds,
  }: DraggableRuleListUpdateItemsProps) {
    if (!rules[overIndex].condition.inner.length) {
      addErrorMessage(t('Specific rules cannot be below uniform rules'));
      return;
    }

    const sortedRules = ruleIds
      .map(ruleId => rules.find(rule => String(rule.id) === ruleId))
      .filter(rule => !!rule) as SamplingRule[];

    setRules(sortedRules);

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: sortedRules}},
        }
      );
      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully sorted sampling rules'));
    } catch (error) {
      setRules(previousRules ?? []);
      const message = t('Unable to sort sampling rules');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  function handleAddRule() {
    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rules={rules}
      />
    ));
  }

  function handleEditRule(rule: SamplingRule) {
    if (isUniformRule(rule)) {
      openModal(
        modalProps => (
          <UniformRateModal
            {...modalProps}
            organization={organization}
            project={project}
            projectStats={projectStats}
            uniformRule={rule}
            rules={rules}
            onSubmit={saveUniformRule}
          />
        ),
        {
          modalCss: responsiveModal,
        }
      );
      return;
    }

    openModal(modalProps => (
      <SpecificConditionsModal
        {...modalProps}
        organization={organization}
        project={project}
        rule={rule}
        rules={rules}
      />
    ));
  }

  async function handleDeleteRule(rule: SamplingRule) {
    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: rules.filter(({id}) => id !== rule.id)}},
        }
      );
      ProjectStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully deleted sampling rule'));
    } catch (error) {
      const message = t('Unable to delete sampling rule');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  async function saveUniformRule(
    sampleRate: number,
    rule?: SamplingRule,
    onSuccess?: () => void,
    onError?: () => void
  ) {
    const newRule: SamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      active: rule ? rule.active : false,
      type: SamplingRuleType.TRACE,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: [],
      },
      sampleRate: sampleRate / 100,
    };

    const newRules = rule
      ? rules.map(existingRule => (existingRule.id === rule.id ? newRule : existingRule))
      : [...rules, newRule];

    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      ProjectStore.onUpdateSuccess(response);
      addSuccessMessage(
        rule
          ? t('Successfully edited sampling rule')
          : t('Successfully added sampling rule')
      );
      onSuccess?.();
    } catch (error) {
      addErrorMessage(
        typeof error === 'string'
          ? error
          : error.message || t('Failed to save sampling rule')
      );
      onError?.();
    }
  }

  // Rules without a condition (Else case) always have to be 'pinned' to the bottom of the list
  // and cannot be sorted
  const items = rules.map(rule => ({
    ...rule,
    id: String(rule.id),
  }));

  const uniformRule = rules.find(isUniformRule);

  return (
    <SentryDocumentTitle title={t('Server-side Sampling')}>
      <Fragment>
        <SettingsPageHeader title={t('Server-side Sampling')} />
        <TextBlock>
          {t(
            'Server-side sampling provides an additional dial for dropping transactions. This comes in handy when your server-side sampling rules target the transactions you want to keep, but you need more of those transactions being sent by the SDK.'
          )}
        </TextBlock>
        <PermissionAlert
          access={['project:write']}
          message={t(
            'These settings can only be edited by users with the organization owner, manager, or admin role.'
          )}
        />
        {!!rules.length && (
          <SamplingSDKAlert
            organization={organization}
            project={project}
            rules={rules}
            recommendedSdkUpgrades={recommendedSdkUpgrades}
          />
        )}
        <RulesPanel>
          <RulesPanelHeader lightText>
            <RulesPanelLayout>
              <GrabColumn />
              <OperatorColumn>{t('Operator')}</OperatorColumn>
              <ConditionColumn>{t('Condition')}</ConditionColumn>
              <RateColumn>{t('Rate')}</RateColumn>
              <ActiveColumn>{t('Active')}</ActiveColumn>
              <Column />
            </RulesPanelLayout>
          </RulesPanelHeader>
          {!rules.length && (
            <Promo onGetStarted={handleGetStarted} hasAccess={hasAccess} />
          )}
          {!!rules.length && (
            <Fragment>
              <DraggableRuleList
                disabled={!hasAccess}
                items={items}
                onUpdateItems={handleSortRules}
                wrapperStyle={({isDragging, isSorting, index}) => {
                  if (isDragging) {
                    return {
                      cursor: 'grabbing',
                    };
                  }
                  if (isSorting) {
                    return {};
                  }
                  return {
                    transform: 'none',
                    transformOrigin: '0',
                    '--box-shadow': 'none',
                    '--box-shadow-picked-up': 'none',
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: rules.length - index,
                    cursor: 'default',
                  };
                }}
                renderItem={({value, listeners, attributes, dragging, sorting}) => {
                  const itemsRuleIndex = items.findIndex(item => item.id === value);

                  if (itemsRuleIndex === -1) {
                    return null;
                  }

                  const itemsRule = items[itemsRuleIndex];

                  const currentRule = {
                    active: itemsRule.active,
                    condition: itemsRule.condition,
                    sampleRate: itemsRule.sampleRate,
                    type: itemsRule.type,
                    id: Number(itemsRule.id),
                  };

                  return (
                    <RulesPanelLayout isContent>
                      <Rule
                        operator={
                          itemsRule.id === items[0].id
                            ? SamplingRuleOperator.IF
                            : isUniformRule(currentRule)
                            ? SamplingRuleOperator.ELSE
                            : SamplingRuleOperator.ELSE_IF
                        }
                        hideGrabButton={items.length === 1}
                        rule={currentRule}
                        onEditRule={() => handleEditRule(currentRule)}
                        onDeleteRule={() => handleDeleteRule(currentRule)}
                        onActivate={() => handleActivateToggle(currentRule.id)}
                        noPermission={!hasAccess}
                        upgradeSdkForProjects={recommendedSdkUpgrades.map(
                          recommendedSdkUpgrade => recommendedSdkUpgrade.project.slug
                        )}
                        listeners={listeners}
                        grabAttributes={attributes}
                        dragging={dragging}
                        sorting={sorting}
                      />
                    </RulesPanelLayout>
                  );
                }}
              />
              <RulesPanelFooter>
                <ButtonBar gap={1}>
                  <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} external>
                    {t('Read Docs')}
                  </Button>
                  <GuideAnchor
                    target="add_conditional_rule"
                    disabled={!uniformRule?.active || !hasAccess || rules.length !== 1}
                  >
                    <AddRuleButton
                      disabled={!hasAccess}
                      title={
                        !hasAccess
                          ? t("You don't have permission to add a rule")
                          : undefined
                      }
                      priority="primary"
                      onClick={handleAddRule}
                      icon={<IconAdd isCircled />}
                    >
                      {t('Add Rule')}
                    </AddRuleButton>
                  </GuideAnchor>
                </ButtonBar>
              </RulesPanelFooter>
            </Fragment>
          )}
        </RulesPanel>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const RulesPanel = styled(Panel)``;

const RulesPanelHeader = styled(PanelHeader)`
  padding: ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const RulesPanelLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 0.5fr 74px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 48px 95px 1fr 0.5fr 77px 74px;
  }

  ${p =>
    p.isContent &&
    css`
      > * {
        /* match the height of the ellipsis button */
        line-height: 34px;
        border-bottom: 1px solid ${p.theme.border};
      }
    `}
`;

const RulesPanelFooter = styled(PanelFooter)`
  border-top: none;
  padding: ${space(1.5)} ${space(2)};
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const AddRuleButton = styled(Button)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }
`;
