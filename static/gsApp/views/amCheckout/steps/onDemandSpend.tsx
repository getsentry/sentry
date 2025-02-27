import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {listDisplayNames} from 'getsentry/utils/dataCategory';
import StepHeader from 'getsentry/views/amCheckout/steps/stepHeader';
import type {StepProps} from 'getsentry/views/amCheckout/types';

type Props = StepProps;

function coerceValue(value: any) {
  const intValue = parseInt(value, 10);

  if (isNaN(intValue)) {
    return undefined;
  }
  return Math.abs(intValue) * 100;
}

function OnDemandSpend({
  subscription,
  isActive,
  stepNumber,
  isCompleted,
  activePlan,
  formData,
  onEdit,
  onUpdate,
  onCompleteStep,
}: Props) {
  const dollars = Number(formData.onDemandMaxSpend) / 100;
  const onDemandDollars = isNaN(dollars) ? '' : dollars.toString();

  const disabled = !(activePlan.allowOnDemand && subscription.supportsOnDemand);
  const title = t('On-Demand Max Spend');
  const oxfordCategories = listDisplayNames({
    plan: activePlan,
    categories: activePlan.checkoutCategories,
  });

  return (
    <Panel>
      <StepHeader
        canSkip
        title={title}
        isActive={isActive}
        stepNumber={stepNumber}
        isCompleted={isCompleted}
        onEdit={onEdit}
      />
      {isActive && (
        <PanelBody data-test-id={title}>
          <OnDemandRow>
            <Header>
              <div>{title}</div>
              <Description>
                {t(
                  "On-Demand spend allows you to pay for additional data beyond your subscription's reserved event volume. Applies to %s.",
                  oxfordCategories
                )}
              </Description>
            </Header>
            <InputContainer>
              <InputHeader>{t('Monthly Max')}</InputHeader>
              <Tooltip
                disabled={!disabled}
                title={t('On-demand is not supported for your account.')}
                data-test-id="ondemand-disabled-tooltip"
              >
                <Currency>
                  <OnDemandInput
                    aria-label="Monthly Max"
                    autoFocus
                    disabled={disabled}
                    name="ondemand"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={7}
                    placeholder="e.g. 50"
                    value={onDemandDollars}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const cents = coerceValue(event.target.value);
                      onUpdate({onDemandMaxSpend: cents});
                    }}
                  />
                </Currency>
              </Tooltip>
            </InputContainer>
          </OnDemandRow>
        </PanelBody>
      )}
      {isActive && (
        <StepFooter data-test-id={title}>
          <div>
            {tct('Need more info? [link:See on-demand pricing chart]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/pricing/legacy-pricing/#per-category-pricing" />
              ),
            })}
          </div>
          <Button priority="primary" onClick={() => onCompleteStep(stepNumber)}>
            {t('Continue')}
          </Button>
        </StepFooter>
      )}
    </Panel>
  );
}

// body
const OnDemandRow = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 65%) minmax(auto, 25%);
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(2)};
  align-items: center;
`;

const Header = styled('div')`
  display: inline-grid;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.textColor};
`;

const Description = styled(TextBlock)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  margin: 0;
`;

const InputContainer = styled('div')`
  display: grid;
  grid-template-rows: repeat(2, auto);
  gap: ${space(1.5)};
  align-items: center;
  justify-items: end;
  color: ${p => p.theme.textColor};
`;

const InputHeader = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  font-weight: bold;
`;

const Currency = styled('span')`
  &::before {
    padding: 11px 10px 9px;
    position: absolute;
    content: '$';
  }
`;

const OnDemandInput = styled(Input)`
  padding-left: ${space(4)};
  color: ${p => p.theme.textColor};
  text-align: right;
  height: 36px;
`;

// footer
const StepFooter = styled(PanelFooter)`
  padding: ${space(2)};
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};
  align-items: center;
`;

export default OnDemandSpend;
