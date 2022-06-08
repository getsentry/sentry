import isEqual from 'lodash/isEqual';
import partition from 'lodash/partition';

import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {
  SamplingConditionOperator,
  SamplingRule,
  SamplingRuleType,
} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import recreateRoute from 'sentry/utils/recreateRoute';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

import RuleModal from './ruleModal';
import {
  distributedTracesConditions,
  generateConditionCategoriesOptions,
  getNewCondition,
  individualTransactionsConditions,
} from './utils';

type RuleModalProps = React.ComponentProps<typeof RuleModal>;

type Props = Omit<
  RuleModalProps,
  'title' | 'description' | 'conditionCategories' | 'onSubmit'
> & {
  type: SamplingRuleType;
};

export function SamplingRuleModal({rule: ruleToUpdate, type, rules, ...props}: Props) {
  const params = useParams();
  const location = useLocation();
  const routes = useRoutes();

  function handleSubmit({
    sampleRate,
    conditions,
    submitRules,
  }: Parameters<RuleModalProps['onSubmit']>[0]) {
    if (!defined(sampleRate)) {
      return;
    }

    const newRule: SamplingRule = {
      // All new/updated rules must have id equal to 0
      id: 0,
      type:
        type === SamplingRuleType.TRACE
          ? SamplingRuleType.TRACE
          : SamplingRuleType.TRANSACTION,
      condition: {
        op: SamplingConditionOperator.AND,
        inner: !conditions.length ? [] : conditions.map(getNewCondition),
      },
      sampleRate: sampleRate / 100,
    };

    const newTransactionRules = ruleToUpdate
      ? rules.map(rule => (isEqual(rule, ruleToUpdate) ? newRule : rule))
      : [...rules, newRule];

    const [transactionTraceRules, individualTransactionRules] = partition(
      newTransactionRules,
      transactionRule => transactionRule.type === SamplingRuleType.TRACE
    );

    const newRules = [...transactionTraceRules, ...individualTransactionRules];

    const currentRuleIndex = newRules.findIndex(newR => newR === newRule);

    submitRules(newRules, currentRuleIndex);
  }

  function getDescription() {
    if (type === SamplingRuleType.TRACE) {
      return {
        title: ruleToUpdate
          ? t('Edit Distributed Trace Rule')
          : t('Add Distributed Trace Rule'),
        description: tct(
          'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions. However, if you only want to select Transactions from within this project, we recommend you add a [link] rule instead.',
          {
            link: (
              <Link
                to={recreateRoute(`${SamplingRuleType.TRANSACTION}/`, {
                  routes,
                  location,
                  params,
                  stepBack: -1,
                })}
              >
                {t('Individual Transaction')}
              </Link>
            ),
          }
        ),
      };
    }

    return {
      title: ruleToUpdate
        ? t('Edit Individual Transaction Rule')
        : t('Add Individual Transaction Rule'),
      description: tct(
        'Select Transactions only within this project which match your conditions. However, If you want to select all Transactions distributed across multiple projects/services, we recommend you add a [link] rule instead.',
        {
          link: (
            <Link
              to={recreateRoute(`${SamplingRuleType.TRACE}/`, {
                routes,
                location,
                params,
                stepBack: -1,
              })}
            >
              {t('Distributed Trace')}
            </Link>
          ),
        }
      ),
    };
  }

  return (
    <RuleModal
      {...props}
      {...getDescription()}
      rules={rules.filter(rule => rule.type === type)}
      conditionCategories={generateConditionCategoriesOptions(
        type === SamplingRuleType.TRACE
          ? distributedTracesConditions
          : individualTransactionsConditions
      )}
      rule={ruleToUpdate}
      onSubmit={handleSubmit}
    />
  );
}
