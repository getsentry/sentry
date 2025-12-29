import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Flex} from '@sentry/scraps/layout';

import type SelectorItems from 'sentry/components/timeRangeSelector/selectorItems';
import type {TimeRangeItem} from 'sentry/components/timeRangeSelector/types';
import {DEFAULT_RELATIVE_PERIODS, MAX_PICKABLE_DAYS} from 'sentry/constants';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import UpsellProvider from 'getsentry/components/upsellProvider';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

const PREMIUM_PERIODS = ['90d'];

type Props = React.ComponentProps<typeof SelectorItems> & {
  subscription: Subscription;
};

function DisabledSelectorItems({
  subscription,
  relativePeriods: relativePeriodsProp,
  shouldShowAbsolute,
  shouldShowRelative,
  handleSelectRelative,
  children,
}: Props) {
  let hasFeature: boolean;

  if (subscription?.planDetails) {
    hasFeature = subscription.planDetails.retentionDays === MAX_PICKABLE_DAYS;
  } else {
    hasFeature = true;
  }

  const relativePeriods = relativePeriodsProp ?? DEFAULT_RELATIVE_PERIODS;

  const hasPremiumPeriods = PREMIUM_PERIODS.some(period =>
    relativePeriods.hasOwnProperty(period)
  );
  const shouldOmitPremiumPeriods = !hasFeature && hasPremiumPeriods;
  const omittedRelativePeriods = shouldOmitPremiumPeriods
    ? omit(relativePeriods, PREMIUM_PERIODS)
    : relativePeriods;
  const omittedRelativeArr = Object.entries(omittedRelativePeriods);

  const items = (onSelect: () => void, canTrial: boolean): TimeRangeItem[] => [
    ...(shouldShowRelative
      ? omittedRelativeArr.map(([value, itemLabel]) => ({
          value,
          textValue: typeof itemLabel === 'string' ? itemLabel : String(value),
          label: <SelectorItemLabel>{itemLabel}</SelectorItemLabel>,
        }))
      : []),
    ...(shouldOmitPremiumPeriods
      ? [
          {
            value: '90d-trial',
            textValue:
              typeof relativePeriods['90d'] === 'string'
                ? relativePeriods['90d']
                : '90d-trial',
            label: (
              <SelectorItemLabel>
                <Flex align="center">
                  {relativePeriods['90d']}
                  <StyledIconBusiness data-test-id="power-icon" />
                </Flex>

                <UpsellMessage>
                  {canTrial
                    ? t('Start Trial for Last 90 Days')
                    : t('Upgrade for Last 90 Days')}
                </UpsellMessage>
              </SelectorItemLabel>
            ),
            onSelect,
          },
        ]
      : []),
    ...(shouldShowAbsolute
      ? [
          {
            value: 'absolute',
            textValue: 'absolute',
            label: <SelectorItemLabel>{t('Absolute date')}</SelectorItemLabel>,
          },
        ]
      : []),
  ];

  return (
    <UpsellProvider
      source="90-day"
      onTrialStarted={() => handleSelectRelative('90d')}
      showConfirmation
    >
      {({canTrial, onClick}) => {
        return children(items(onClick, canTrial));
      }}
    </UpsellProvider>
  );
}

const SelectorItemLabel = styled('div')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

const UpsellMessage = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const StyledIconBusiness = styled(IconBusiness)`
  display: grid;
  align-items: center;
  margin-left: ${space(0.5)};
`;

export default withSubscription(DisabledSelectorItems, {noLoader: true});
