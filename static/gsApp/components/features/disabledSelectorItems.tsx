import styled from '@emotion/styled';
import omit from 'lodash/omit';

import type {Item} from 'sentry/components/dropdownAutoComplete/types';
import type SelectorItems from 'sentry/components/timeRangeSelector/selectorItems';
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

  if (!subscription || !subscription.planDetails) {
    hasFeature = true;
  } else {
    hasFeature = subscription.planDetails.retentionDays === MAX_PICKABLE_DAYS;
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

  const items: Item[] = [
    ...(shouldShowRelative
      ? omittedRelativeArr.map(([value, itemLabel], index) => ({
          index,
          value,
          searchKey: typeof itemLabel === 'string' ? itemLabel : String(value),
          label: <SelectorItemLabel>{itemLabel}</SelectorItemLabel>,
          'data-test-id': value,
        }))
      : []),
    ...(shouldOmitPremiumPeriods
      ? [
          {
            index: omittedRelativeArr.length,
            value: '90d-trial',
            searchKey:
              typeof relativePeriods['90d'] === 'string'
                ? relativePeriods['90d']
                : '90d-trial',
            label: (
              <UpsellProvider
                source="90-day"
                onTrialStarted={() => handleSelectRelative('90d')}
                showConfirmation
              >
                {({canTrial, onClick}) => {
                  const text = canTrial
                    ? t('Start Trial for Last 90 Days')
                    : t('Upgrade for Last 90 Days');

                  return (
                    <SelectorItemLabel>
                      <UpsellClickZone
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          onClick();
                        }}
                      />
                      <UpsellLabelWrap>
                        {relativePeriods['90d']}
                        <StyledIconBusiness gradient data-test-id="power-icon" />
                      </UpsellLabelWrap>

                      <UpsellMessage>{text}</UpsellMessage>
                    </SelectorItemLabel>
                  );
                }}
              </UpsellProvider>
            ),
            'data-test-id': '90d',
          },
        ]
      : []),
    ...(shouldShowAbsolute
      ? [
          {
            index: omittedRelativeArr.length + 1,
            value: 'absolute',
            searchKey: 'absolute',
            label: <SelectorItemLabel>{t('Absolute date')}</SelectorItemLabel>,
            'data-test-id': 'absolute',
          },
        ]
      : []),
  ];

  return children(items);
}

const SelectorItemLabel = styled('div')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

const UpsellLabelWrap = styled('div')`
  display: flex;
  align-items: center;
`;

const UpsellMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const UpsellClickZone = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
`;

const StyledIconBusiness = styled(IconBusiness)`
  display: grid;
  align-items: center;
  margin-left: ${space(0.5)};
`;

export default withSubscription(DisabledSelectorItems, {noLoader: true});
