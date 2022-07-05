import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {SamplingRule, SamplingRuleOperator, SamplingRules} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {DraggableList, UpdateItemsProps} from '../sampling/rules/draggableList';

import {ActivateModal} from './modals/activateModal';
import {SpecificConditionsModal} from './modals/specificConditionsModal';
import {UniformRateModal} from './modals/uniformRateModal';
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
import {SERVER_SIDE_SAMPLING_DOC_LINK} from './utils';

type Props = {
  project: Project;
};

export function ServerSideSampling({project}: Props) {
  const organization = useOrganization();
  const api = useApi();

  const hasAccess = organization.access.includes('project:write');
  const currentRules = project.dynamicSampling?.rules;
  const previousRules = usePrevious(currentRules);
  const [rules, setRules] = useState<SamplingRules>(currentRules ?? []);

  useEffect(() => {
    if (!isEqual(previousRules, currentRules)) {
      setRules(currentRules ?? []);
    }
  }, [currentRules, previousRules]);

  function handleActivateToggle(rule: SamplingRule) {
    openModal(modalProps => <ActivateModal {...modalProps} rule={rule} />);
  }

  function handleGetStarted() {
    openModal(modalProps => (
      <UniformRateModal {...modalProps} organization={organization} project={project} />
    ));
  }

  async function handleSortRules({overIndex, reorderedItems: ruleIds}: UpdateItemsProps) {
    if (!rules[overIndex].condition.inner.length) {
      addErrorMessage(
        t('Rules with conditions cannot be below rules without conditions')
      );
      return;
    }

    const sortedRules = ruleIds
      .map(ruleId => rules.find(rule => String(rule.id) === ruleId))
      .filter(rule => !!rule) as SamplingRule[];

    setRules(sortedRules);

    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: sortedRules}},
        }
      );
      ProjectStore.onUpdateSuccess(newProjectDetails);
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
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {dynamicSampling: {rules: rules.filter(({id}) => id !== rule.id)}},
        }
      );
      ProjectStore.onUpdateSuccess(newProjectDetails);
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
    bottomPinned: !rule.condition.inner.length,
  }));

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
              <DraggableList
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
                            : itemsRule.bottomPinned
                            ? SamplingRuleOperator.ELSE
                            : SamplingRuleOperator.ELSE_IF
                        }
                        hideGrabButton={items.length === 1}
                        rule={{
                          ...currentRule,
                          bottomPinned: itemsRule.bottomPinned,
                        }}
                        onEditRule={() => handleEditRule(currentRule)}
                        onDeleteRule={() => handleDeleteRule(currentRule)}
                        onActivate={() => handleActivateToggle(currentRule)}
                        noPermission={!hasAccess}
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
