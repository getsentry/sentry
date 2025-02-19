import {Component} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import Input from 'sentry/components/input';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import type {OnDemandBudgets} from 'getsentry/types';
import {OnDemandBudgetMode} from 'getsentry/types';

function coerceValue(value: number): number {
  return value / 100;
}

function parseInputValue(e: React.ChangeEvent<HTMLInputElement>) {
  let value = parseInt(e.target.value, 10) || 0;
  value = Math.max(value, 0);
  const cents = value * 100;
  return cents;
}

type Props = {
  payAsYouGoBudget: OnDemandBudgets;
  setPayAsYouGoBudget: (onDemandBudget: OnDemandBudgets) => void;
};

class PayAsYouGoBudgetEdit extends Component<Props> {
  render() {
    const {payAsYouGoBudget, setPayAsYouGoBudget} = this.props;
    const sharedMaxBudget =
      payAsYouGoBudget.budgetMode === OnDemandBudgetMode.SHARED
        ? payAsYouGoBudget.sharedMaxBudget
        : 0;

    return (
      <PanelBody withPadding>
        <InputFields style={{alignSelf: 'center'}}>
          <InputDiv>
            <Column>
              <Title>{t('Pay-as-you-go Budget')}</Title>
              <Description>
                {t(
                  "This budget ensures continued monitoring after you've used up your reserved event volume. We’ll only charge you for actual usage, so this is your maximum charge for overage."
                )}
              </Description>
            </Column>
            <Column>
              <InputLabel>{t('Amount')}</InputLabel>
              <Currency>
                <PayAsYouGoInput
                  aria-label="Pay-as-you-go budget"
                  name="payAsYouGoBudget"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  placeholder="e.g. 50"
                  value={coerceValue(sharedMaxBudget)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setPayAsYouGoBudget({
                      budgetMode: OnDemandBudgetMode.SHARED,
                      sharedMaxBudget: parseInputValue(e),
                    });
                  }}
                />
              </Currency>
            </Column>
          </InputDiv>
        </InputFields>
        {sharedMaxBudget === 0 && (
          <StyledAlert type="info" icon={<IconInfo />} showIcon>
            {t(
              'Setting this to $0 may result in you losing the ability to fully monitor your applications within Sentry.'
            )}
          </StyledAlert>
        )}
      </PanelBody>
    );
  }
}

const InputFields = styled('div')`
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: 1px;
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  margin: 0;
`;

const Currency = styled('div')`
  &::before {
    position: absolute;
    padding: 9px ${space(1.5)};
    content: '$';
    color: ${p => p.theme.subText};
    font-weight: bold;
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const PayAsYouGoInput = styled(Input)`
  color: ${p => p.theme.textColor};
  max-width: 120px;
  height: 36px;
  text-align: right;
`;

const InputDiv = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  gap: 88px;
  align-items: start;
`;

const Title = styled('label')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
`;

const Column = styled('div')`
  display: grid;
  grid-template-columns: auto;
  gap: ${space(1)};
`;

const InputLabel = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  color: ${p => p.theme.gray400};
  text-align: right;
`;

const StyledAlert = styled(Alert)`
  margin: ${space(1)} 0 0;
`;

export default PayAsYouGoBudgetEdit;
