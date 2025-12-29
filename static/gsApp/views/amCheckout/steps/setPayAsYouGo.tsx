import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {IconAdd, IconInfo, IconLock, IconSentry, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {SpaceSize} from 'sentry/utils/theme';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {PAYG_BUSINESS_DEFAULT, PAYG_TEAM_DEFAULT} from 'getsentry/constants';
import {OnDemandBudgetMode, type OnDemandBudgets} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import {getPlanCategoryName} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import StepHeader from 'getsentry/views/amCheckout/components/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';
import {getTotalBudget} from 'getsentry/views/onDemandBudgets/utils';

const INCREMENT_STEP = 25_00;

function SetPayAsYouGo({
  isActive,
  organization,
  subscription,
  activePlan,
  stepNumber,
  isCompleted,
  formData,
  onEdit,
  onUpdate,
  onCompleteStep,
}: StepProps) {
  const [currentBudget, setCurrentBudget] = useState<number>(
    formData.onDemandBudget ? getTotalBudget(formData.onDemandBudget) : 0
  );

  useEffect(() => {
    if (isActive) {
      // When step becomes active, set the current budget to the value in formData
      // to ensure we've got the latest value (e.g. if the user changed plan type
      // so the default is different from when this was first rendered)
      setCurrentBudget(
        formData.onDemandBudget ? getTotalBudget(formData.onDemandBudget) : 0
      );
    }
  }, [isActive, formData.onDemandBudget]);

  const checkoutCategories = useMemo(() => {
    return activePlan.checkoutCategories;
  }, [activePlan]);

  const addOnCategories = useMemo(() => {
    return Object.values(activePlan.addOnCategories).filter(
      addOnInfo => subscription.addOns?.[addOnInfo.apiName]?.isAvailable ?? false
    );
  }, [activePlan, subscription.addOns]);

  const paygOnlyCategories = useMemo(() => {
    return activePlan.categories.filter(
      category =>
        activePlan.planCategories[category]?.length === 1 &&
        activePlan.planCategories[category][0]?.events === 0
    );
  }, [activePlan]);

  const suggestedBudgetForPlan = useMemo(() => {
    return isBizPlanFamily(activePlan) ? PAYG_BUSINESS_DEFAULT : PAYG_TEAM_DEFAULT;
  }, [activePlan]);

  const handleBudgetChange = useCallback(
    (value: OnDemandBudgets, fromButton = false) => {
      // NOTE: `value` is always a SharedOnDemandBudget here because we don't support per-category budgets
      // on AM3 but we use getTotalBudget anyway to be type safe
      const totalBudget = getTotalBudget(value);
      onUpdate({
        ...formData,
        onDemandBudget: value,
        onDemandMaxSpend: totalBudget,
      });

      if (organization) {
        trackGetsentryAnalytics('checkout.payg_changed', {
          organization,
          subscription,
          plan: formData.plan,
          cents: totalBudget || 0,
          method: fromButton ? 'button' : 'textbox',
        });
      }
      setCurrentBudget(totalBudget);
    },
    [onUpdate, organization, subscription, formData]
  );

  const coerceValue = (value: number): string => {
    return (value / 100).toString();
  };

  const parseInputValue = (e: React.ChangeEvent<HTMLInputElement>): number => {
    let value = parseInt(e.target.value, 10) || 0;
    value = Math.max(value, 0);
    const cents = value * 100;
    return cents;
  };

  const incrementBudget = (step: number) => {
    handleBudgetChange(
      {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: Math.max(0, currentBudget + step),
      },
      true
    );
  };

  const renderProductAccessInfo = () => {
    if (paygOnlyCategories.length === 0) {
      return null;
    }

    const coveredProductsTitle =
      currentBudget === 0 ? t('No additional coverage') : t('Covers additional usage');
    const coveredProductsSubtitle =
      currentBudget === 0
        ? t('Risk of data loss during an overage')
        : t('Prevents dropped data');
    const paygProductsTitle =
      currentBudget === 0 ? t('No product access') : t('Requires pay-as-you-go budget');
    const paygProductsSubtitle =
      currentBudget === 0
        ? t('Requires pay-as-you-go budget')
        : t('Unlocks product access');

    return (
      <TwoColumnContainer gap="xl" alignItems="stretch" columnWidth="1fr">
        <Box>
          <Title>{coveredProductsTitle}</Title>
          <CategoryInfoDescription>{coveredProductsSubtitle}</CategoryInfoDescription>
          <CategoryInfoList>
            {checkoutCategories
              .filter(category => !paygOnlyCategories.includes(category))
              .map(category => (
                <li key={category}>
                  <IconSubtract size="xs" />
                  <span>
                    {getPlanCategoryName({
                      plan: activePlan,
                      category,
                    })}
                  </span>
                </li>
              ))}
            {addOnCategories.map(addOnInfo => (
              <li key={addOnInfo.apiName}>
                <IconSubtract size="xs" />
                <span>
                  {toTitleCase(addOnInfo.productName, {allowInnerUpperCase: true})}
                </span>
              </li>
            ))}
          </CategoryInfoList>
        </Box>
        <Box>
          <TwoColumnContainer alignItems="start" justifyContent="space-between">
            <div>
              <Title>{paygProductsTitle}</Title>
              <CategoryInfoDescription>{paygProductsSubtitle}</CategoryInfoDescription>
              <CategoryInfoList>
                {paygOnlyCategories.map(category => (
                  <li key={category}>
                    {currentBudget === 0 ? (
                      <IconLock size="xs" locked />
                    ) : (
                      <IconSubtract size="xs" />
                    )}
                    <span>
                      {getPlanCategoryName({
                        plan: activePlan,
                        category,
                      })}
                    </span>
                  </li>
                ))}
              </CategoryInfoList>
            </div>
            {currentBudget === 0 && (
              <Box padding={`${space(1)} ${space(1)} ${space(0.5)}`}>
                <IconLock locked />
              </Box>
            )}
          </TwoColumnContainer>
        </Box>
      </TwoColumnContainer>
    );
  };

  const renderBody = () => {
    return (
      <StyledPanelBody data-test-id="body-set-payg" withPadding>
        <TwoColumnContainer>
          <Column>
            <Title>{t('Pay-as-you-go Budget')}</Title>
            <Description>
              {t(
                "Pay-as-you-go applies across all Sentry products, on a first-come, first-served basis. You're charged only for what you use, capped at your defined monthly limit."
              )}
            </Description>
            <Description>
              {t(
                'Once this limit is reached, data collection will automatically stop until the next usage cycle begins.'
              )}
            </Description>
            <Description>
              {t(
                'Charges are applied at the end of your usage cycle, and budget can be adjusted at anytime.'
              )}
            </Description>
          </Column>
          <Column>
            <PayAsYouGoInputContainer>
              <Button
                icon={<IconSubtract />}
                aria-label={t('Decrease')}
                onClick={() => incrementBudget(-INCREMENT_STEP)}
              />
              <Currency>
                <PayAsYouGoInput
                  aria-label="Pay-as-you-go budget"
                  name="payAsYouGoBudget"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  placeholder="e.g. 50"
                  value={coerceValue(currentBudget)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleBudgetChange({
                      budgetMode: OnDemandBudgetMode.SHARED,
                      sharedMaxBudget: parseInputValue(e),
                    });
                  }}
                />
              </Currency>
              <Button
                icon={<IconAdd />}
                aria-label={t('Increase')}
                onClick={() => incrementBudget(INCREMENT_STEP)}
              />
            </PayAsYouGoInputContainer>
            <AnimatePresence>
              {(currentBudget === suggestedBudgetForPlan ||
                (currentBudget === 0 && paygOnlyCategories.length > 0)) && (
                <motion.div
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                  transition={{
                    type: 'spring',
                    duration: 0.4,
                    bounce: 0.1,
                  }}
                >
                  <SuggestedAmountTag
                    icon={
                      currentBudget === suggestedBudgetForPlan ? (
                        <IconSentry />
                      ) : (
                        <IconLock locked />
                      )
                    }
                  >
                    {currentBudget === suggestedBudgetForPlan
                      ? t('Suggested Amount')
                      : t('Products locked')}
                  </SuggestedAmountTag>
                </motion.div>
              )}
            </AnimatePresence>
          </Column>
        </TwoColumnContainer>
        <AnimatePresence>
          {currentBudget === 0 && (
            <motion.div
              initial={{height: 0, opacity: 0}}
              animate={{height: 'auto', opacity: 1}}
              exit={{height: 0, opacity: 0}}
              transition={{
                type: 'spring',
                duration: 0.4,
                bounce: 0.1,
              }}
            >
              <Alert variant="info" icon={<IconInfo />}>
                {t(
                  'Setting this to $0 may result in you losing the ability to fully monitor your applications within Sentry.'
                )}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
        {renderProductAccessInfo()}
      </StyledPanelBody>
    );
  };

  const renderFooter = () => {
    return (
      <StepFooter data-test-id="footer-set-payg">
        <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
          {t('Continue')}
        </Button>
      </StepFooter>
    );
  };

  return (
    <Panel>
      <StepHeader
        canSkip
        title={t('Set Your Pay-as-you-go Budget')}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && renderBody()}
      {isActive && renderFooter()}
    </Panel>
  );
}

export default SetPayAsYouGo;

const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  align-items: center;
  justify-content: end;
`;

const Currency = styled('div')`
  &::before {
    position: absolute;
    padding: 9px ${space(1.5)};
    content: '$';
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const PayAsYouGoInput = styled(Input)`
  color: ${p => p.theme.tokens.content.primary};
  max-width: 120px;
  height: 36px;
  text-align: right;
  font-weight: bold;
`;

const PayAsYouGoInputContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: ${space(1)};
  align-items: start;
`;

const StyledPanelBody = styled(PanelBody)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const TwoColumnContainer = styled('div')<{
  alignItems?: string;
  columnWidth?: string;
  gap?: SpaceSize;
  justifyContent?: string;
}>`
  display: grid;
  grid-template-columns: repeat(2, ${p => p.columnWidth || 'auto'});
  gap: ${p => p.theme.space[p.gap ?? '3xl']};
  align-items: ${p => p.alignItems || 'start'};
  justify-content: ${p => p.justifyContent || 'normal'};
`;

const Column = styled('div')`
  display: grid;
  grid-template-columns: auto;
  gap: ${space(1)};
`;

const Box = styled('div')<{padding?: string}>`
  border: 1px solid ${p => p.theme.border};
  padding: ${p => p.padding || space(2)};
  border-radius: ${p => p.theme.radius.md};
`;

const Title = styled('label')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSize.lg};
  margin: 0;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const SuggestedAmountTag = styled(Tag)`
  max-width: fit-content;
  justify-self: center;
  display: flex;
  align-items: center;
  line-height: normal;
`;

const CategoryInfoDescription = styled(Description)`
  font-size: ${p => p.theme.fontSize.sm};
`;

const CategoryInfoList = styled('ul')`
  margin: ${space(1)} 0;
  padding: 0;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};

  li {
    list-style-type: none;
    display: flex;
    align-items: center;
    gap: ${space(1)};
  }
`;
