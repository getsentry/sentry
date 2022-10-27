import {Fragment, useCallback, useEffect, useState} from 'react';
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
  fetchProjectStats,
  fetchSamplingDistribution,
  fetchSamplingSdkVersions,
} from 'sentry/actionCreators/serverSideSampling';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {
  SamplingConditionOperator,
  SamplingRule,
  SamplingRuleOperator,
  SamplingRuleType,
  UniformModalsSubmit,
} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import usePrevious from 'sentry/utils/usePrevious';
import {useRouteContext} from 'sentry/utils/useRouteContext';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {SpecificConditionsModal} from './modals/specificConditionsModal';
import {responsiveModal} from './modals/styles';
import {UniformRateModal} from './modals/uniformRateModal';
import {useProjectStats} from './utils/useProjectStats';
import {useRecommendedSdkUpgrades} from './utils/useRecommendedSdkUpgrades';
import {DraggableRuleList, DraggableRuleListUpdateItemsProps} from './draggableRuleList';
import {
  ActiveColumn,
  Column,
  ConditionColumn,
  GrabColumn,
  OperatorColumn,
  RateColumn,
  Rule,
} from './rule';
import {SamplingBreakdown} from './samplingBreakdown';
import {SamplingFeedback} from './samplingFeedback';
import {SamplingFromOtherProject} from './samplingFromOtherProject';
import {SamplingProjectIncompatibleAlert} from './samplingProjectIncompatibleAlert';
import {SamplingPromo} from './samplingPromo';
import {SamplingSDKClientRateChangeAlert} from './samplingSDKClientRateChangeAlert';
import {SamplingSDKUpgradesAlert} from './samplingSDKUpgradesAlert';
import {isUniformRule, SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

const LimitedAvailabilityProgramEndingAlert = HookOrDefault({
  hookName: 'component:dynamic-sampling-limited-availability-program-ending',
});

type Props = {
  project: Project;
};

export function ServerSideSampling({project}: Props) {
  const organization = useOrganization();
  const api = useApi();

  const hasAccess = organization.access.includes('project:write');
  const canDemo = organization.features.includes('dynamic-sampling-demo');
  const currentRules = project.dynamicSampling?.rules;

  const previousRules = usePrevious(currentRules);
  const navigate = useNavigate();
  const params = useParams();
  const routeContext = useRouteContext();
  const router = routeContext.router;

  const samplingProjectSettingsPath = `/settings/${organization.slug}/projects/${project.slug}/dynamic-sampling/`;

  const [rules, setRules] = useState<SamplingRule[]>(currentRules ?? []);

  useEffect(() => {
    trackAdvancedAnalyticsEvent('sampling.settings.view', {
      organization,
      project_id: project.id,
    });
  }, [project.id, organization]);

  useEffect(() => {
    return () => {
      if (!router.location.pathname.startsWith(samplingProjectSettingsPath)) {
        ServerSideSamplingStore.reset();
      }
    };
  }, [router.location.pathname, samplingProjectSettingsPath]);

  useEffect(() => {
    if (!isEqual(previousRules, currentRules)) {
      setRules(currentRules ?? []);
    }
  }, [currentRules, previousRules]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    async function fetchData() {
      fetchProjectStats({
        orgSlug: organization.slug,
        api,
        projId: project.id,
      });

      await fetchSamplingDistribution({
        orgSlug: organization.slug,
        projSlug: project.slug,
        api,
      });

      await fetchSamplingSdkVersions({
        orgSlug: organization.slug,
        api,
        projectID: project.id,
      });
    }

    fetchData();
  }, [api, organization.slug, project.slug, project.id, hasAccess]);

  const handleReadDocs = useCallback(() => {
    trackAdvancedAnalyticsEvent('sampling.settings.view_read_docs', {
      organization,
      project_id: project.id,
    });
  }, [organization, project.id]);

  const {
    recommendedSdkUpgrades,
    isProjectIncompatible,
    loading: loadingRecommendedSdkUpgrades,
  } = useRecommendedSdkUpgrades({
    organization,
    projectId: project.id,
  });

  const saveUniformRule = useCallback(
    async ({
      sampleRate,
      uniformRateModalOrigin,
      onError,
      onSuccess,
      rule,
    }: Parameters<UniformModalsSubmit>[0]) => {
      if (isProjectIncompatible) {
        addErrorMessage(
          t('Your project is currently incompatible with Dynamic Sampling.')
        );
        return;
      }

      const newRule: SamplingRule = {
        // All new rules must have the default id set to -1, signaling to the backend that a proper id should
        // be assigned.
        id: -1,
        active: rule ? rule.active : false,
        type: SamplingRuleType.TRACE,
        condition: {
          op: SamplingConditionOperator.AND,
          inner: [],
        },
        sampleRate,
      };

      trackAdvancedAnalyticsEvent(
        uniformRateModalOrigin
          ? 'sampling.settings.modal.uniform.rate_done'
          : 'sampling.settings.modal.recommended.next.steps_done',
        {
          organization,
          project_id: project.id,
        }
      );

      trackAdvancedAnalyticsEvent(
        rule
          ? 'sampling.settings.rule.uniform_update'
          : 'sampling.settings.rule.uniform_create',
        {
          organization,
          project_id: project.id,
          sampling_rate: newRule.sampleRate,
          old_sampling_rate: rule ? rule.sampleRate : null,
        }
      );

      trackAdvancedAnalyticsEvent('sampling.settings.rule.uniform_save', {
        organization,
        project_id: project.id,
        sampling_rate: newRule.sampleRate,
        old_sampling_rate: rule ? rule.sampleRate : null,
      });

      const newRules = rule
        ? rules.map(existingRule =>
            existingRule.id === rule.id ? newRule : existingRule
          )
        : [...rules, newRule];

      try {
        const response = await api.requestPromise(
          `/projects/${organization.slug}/${project.slug}/`,
          {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
        );
        ProjectsStore.onUpdateSuccess(response);
        addSuccessMessage(
          rule
            ? t('Successfully edited sampling rule')
            : t('Successfully added sampling rule')
        );
        onSuccess?.(response.dynamicSampling?.rules ?? []);
      } catch (error) {
        addErrorMessage(
          typeof error === 'string'
            ? error
            : error.message || t('Failed to save sampling rule')
        );
        onError?.();
      }
    },
    [api, project.slug, project.id, organization, isProjectIncompatible, rules]
  );

  const handleOpenUniformRateModal = useCallback(
    (rule?: SamplingRule) => {
      openModal(
        modalProps => (
          <UniformRateModal
            {...modalProps}
            organization={organization}
            project={project}
            rules={rules}
            onSubmit={saveUniformRule}
            onReadDocs={handleReadDocs}
            uniformRule={rule}
          />
        ),
        {
          modalCss: responsiveModal,
          onClose: () => {
            navigate(samplingProjectSettingsPath);
          },
        }
      );
    },
    [
      navigate,
      organization,
      project,
      rules,
      saveUniformRule,
      handleReadDocs,
      samplingProjectSettingsPath,
    ]
  );

  const handleOpenSpecificConditionsModal = useCallback(
    (rule?: SamplingRule) => {
      openModal(
        modalProps => (
          <SpecificConditionsModal
            {...modalProps}
            organization={organization}
            project={project}
            rule={rule}
            rules={rules}
          />
        ),
        {
          modalCss: responsiveModal,
          onClose: () => {
            navigate(samplingProjectSettingsPath);
          },
        }
      );
    },
    [navigate, organization, project, rules, samplingProjectSettingsPath]
  );

  useEffect(() => {
    if (
      router.location.pathname !== `${samplingProjectSettingsPath}rules/${params.rule}/`
    ) {
      return;
    }

    if (router.location.pathname === `${samplingProjectSettingsPath}rules/uniform/`) {
      const uniformRule = rules.find(isUniformRule);
      handleOpenUniformRateModal(uniformRule);
      return;
    }

    if (router.location.pathname === `${samplingProjectSettingsPath}rules/new/`) {
      handleOpenSpecificConditionsModal();
      return;
    }

    const rule = rules.find(r => String(r.id) === params.rule);

    if (!rule) {
      addErrorMessage(t('Unable to find sampling rule'));
      return;
    }

    if (isUniformRule(rule)) {
      handleOpenUniformRateModal(rule);
      return;
    }

    handleOpenSpecificConditionsModal(rule);
  }, [
    params.rule,
    handleOpenUniformRateModal,
    handleOpenSpecificConditionsModal,
    rules,
    router.location.pathname,
    samplingProjectSettingsPath,
  ]);

  const {projectStats48h} = useProjectStats();

  async function handleActivateToggle(rule: SamplingRule) {
    if (isProjectIncompatible) {
      addErrorMessage(t('Your project is currently incompatible with Dynamic Sampling.'));
      return;
    }

    const newRules = rules.map(r => {
      if (r.id === rule.id) {
        return {
          ...r,
          id: -1,
          active: !r.active,
        };
      }
      return r;
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
      ProjectsStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully updated the sampling rule'));
    } catch (error) {
      const message = t('Unable to update the sampling rule');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }

    if (isUniformRule(rule)) {
      trackAdvancedAnalyticsEvent(
        rule.active
          ? 'sampling.settings.rule.uniform_deactivate'
          : 'sampling.settings.rule.uniform_activate',
        {
          organization,
          project_id: project.id,
          sampling_rate: rule.sampleRate,
        }
      );
    } else {
      const analyticsConditions = rule.condition.inner.map(condition => condition.name);
      const analyticsConditionsStringified = analyticsConditions.sort().join(', ');

      trackAdvancedAnalyticsEvent(
        rule.active
          ? 'sampling.settings.rule.specific_deactivate'
          : 'sampling.settings.rule.specific_activate',
        {
          organization,
          project_id: project.id,
          sampling_rate: rule.sampleRate,
          conditions: analyticsConditions,
          conditions_stringified: analyticsConditionsStringified,
        }
      );
    }
  }

  function handleGetStarted() {
    trackAdvancedAnalyticsEvent('sampling.settings.view_get_started', {
      organization,
      project_id: project.id,
    });

    navigate(`${samplingProjectSettingsPath}rules/uniform/`);
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
      ProjectsStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully sorted sampling rules'));
    } catch (error) {
      setRules(previousRules ?? []);
      const message = t('Unable to sort sampling rules');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
    }
  }

  async function handleDeleteRule(rule: SamplingRule) {
    const conditions = rule.condition.inner.map(({name}) => name);

    trackAdvancedAnalyticsEvent('sampling.settings.rule.specific_delete', {
      organization,
      project_id: project.id,
      sampling_rate: rule.sampleRate,
      conditions,
      conditions_stringified: conditions.sort().join(', '),
    });

    try {
      const result = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: rules.filter(({id}) => id !== rule.id)}},
        }
      );
      ProjectsStore.onUpdateSuccess(result);
      addSuccessMessage(t('Successfully deleted sampling rule'));
    } catch (error) {
      const message = t('Unable to delete sampling rule');
      handleXhrErrorResponse(message)(error);
      addErrorMessage(message);
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
    <SentryDocumentTitle title={t('Dynamic Sampling')}>
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              {t('Dynamic Sampling')} <FeatureBadge type="beta" />
            </Fragment>
          }
          action={<SamplingFeedback />}
        />
        <TextBlock>
          {tct(
            'Improve the accuracy of your [performanceMetrics: performance metrics] and [targetTransactions: target those transactions] which are most valuable for your organization. Server-side rules are applied immediately, without having to re-deploy your app.',
            {
              performanceMetrics: (
                <ExternalLink href="https://docs.sentry.io/product/performance/metrics/#metrics-and-sampling" />
              ),
              targetTransactions: <ExternalLink href={SERVER_SIDE_SAMPLING_DOC_LINK} />,
            }
          )}
        </TextBlock>
        <PermissionAlert
          access={['project:write']}
          message={t(
            'These settings can only be edited by users with the organization owner, manager, or admin role.'
          )}
        />

        <LimitedAvailabilityProgramEndingAlert />

        <SamplingProjectIncompatibleAlert
          organization={organization}
          projectId={project.id}
          isProjectIncompatible={isProjectIncompatible}
        />

        {!!rules.length && (
          <SamplingSDKUpgradesAlert
            organization={organization}
            projectId={project.id}
            recommendedSdkUpgrades={recommendedSdkUpgrades}
            onReadDocs={handleReadDocs}
          />
        )}

        {!!rules.length && !recommendedSdkUpgrades.length && (
          <SamplingSDKClientRateChangeAlert
            onReadDocs={handleReadDocs}
            projectStats={projectStats48h.data}
            organization={organization}
            projectId={project.id}
          />
        )}

        <SamplingFromOtherProject
          orgSlug={organization.slug}
          projectSlug={project.slug}
        />

        {hasAccess && <SamplingBreakdown orgSlug={organization.slug} />}
        {!rules.length ? (
          <SamplingPromo
            onGetStarted={handleGetStarted}
            onReadDocs={handleReadDocs}
            hasAccess={hasAccess}
          />
        ) : (
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
                      onEditRule={() => {
                        navigate(
                          isUniformRule(currentRule)
                            ? `${samplingProjectSettingsPath}rules/uniform/`
                            : `${samplingProjectSettingsPath}rules/${currentRule.id}/`
                        );
                      }}
                      canDemo={canDemo}
                      onDeleteRule={() => handleDeleteRule(currentRule)}
                      onActivate={() => handleActivateToggle(currentRule)}
                      noPermission={!hasAccess}
                      upgradeSdkForProjects={recommendedSdkUpgrades.map(
                        recommendedSdkUpgrade => recommendedSdkUpgrade.project.slug
                      )}
                      listeners={listeners}
                      grabAttributes={attributes}
                      dragging={dragging}
                      sorting={sorting}
                      loadingRecommendedSdkUpgrades={loadingRecommendedSdkUpgrades}
                    />
                  </RulesPanelLayout>
                );
              }}
            />
            <RulesPanelFooter>
              <ButtonBar gap={1}>
                <Button
                  href={SERVER_SIDE_SAMPLING_DOC_LINK}
                  onClick={handleReadDocs}
                  external
                >
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
                    onClick={() => navigate(`${samplingProjectSettingsPath}rules/new/`)}
                    icon={<IconAdd isCircled />}
                  >
                    {t('Add Rule')}
                  </AddRuleButton>
                </GuideAnchor>
              </ButtonBar>
            </RulesPanelFooter>
          </RulesPanel>
        )}
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
    grid-template-columns: 48px 97px 1fr 0.5fr 77px 74px;
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
