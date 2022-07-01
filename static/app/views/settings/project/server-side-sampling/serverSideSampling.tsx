import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelFooter, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {
  SamplingRuleOperator,
  SamplingRules,
  SamplingRuleType,
} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {DraggableList} from '../sampling/rules/draggableList';

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

export function ServerSideSampling() {
  const api = useApi();
  const organization = useOrganization();
  const params = useParams();
  const hasAccess = organization.access.includes('project:write');

  const {orgId: orgSlug, projectId: projectSlug} = params;

  const [rules, setRules] = useState<SamplingRules>([]);
  const [project, setProject] = useState<Project>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchRules() {
      try {
        // TODO(sampling): no need to fetch project here, settings pages get it via props for free
        const projectDetails = await api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/`
        );

        const {dynamicSampling} = projectDetails;
        const samplingRules: SamplingRules = dynamicSampling?.rules ?? [];

        const traceRules = samplingRules.filter(
          samplingRule => samplingRule.type === SamplingRuleType.TRACE
        );

        setRules(traceRules);
        setProject(projectDetails);
        setLoading(false);
      } catch (err) {
        const errorMessage = t('Unable to load sampling rules');
        handleXhrErrorResponse(errorMessage)(err);
        setError(errorMessage);
        setLoading(false);
      }
    }
    fetchRules();
  }, [api, projectSlug, orgSlug]);

  function handleGetStarted() {
    openModal(modalProps => (
      <UniformRateModal {...modalProps} organization={organization} project={project} />
    ));
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
        {error && <LoadingError message={error} />}
        {!error && loading && <LoadingIndicator />}
        {!error && !loading && (
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
                  onUpdateItems={() => {}}
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
                          onEditRule={() => {}}
                          onDeleteRule={() => {}}
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
                      onClick={() => {}}
                      icon={<IconAdd isCircled />}
                    >
                      {t('Add Rule')}
                    </AddRuleButton>
                  </ButtonBar>
                </RulesPanelFooter>
              </Fragment>
            )}
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
