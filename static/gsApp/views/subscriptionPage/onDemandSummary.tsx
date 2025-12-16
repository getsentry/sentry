import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Input} from 'sentry/components/core/input';
import {Tooltip} from 'sentry/components/core/tooltip';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import {openEditCreditCard} from 'getsentry/actionCreators/modal';
import OnDemandPrice from 'getsentry/components/onDemandPrice';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {displayBudgetName, hasPerformance} from 'getsentry/utils/billing';
import {listDisplayNames} from 'getsentry/utils/dataCategory';

function coerceValue(value: number): number {
  return value / 100;
}

type DefaultProps = {
  withHeader?: boolean;
  withPanel?: boolean;
};

type Props = DefaultProps & {
  enabled: boolean;
  hasPaymentSource: boolean;
  organization: Organization;
  pricePerEvent: number;
  subscription: Subscription;
  // value is in whole cents
  value: number;
  changeOnDemand?: (cents: number) => void;
  error?: string | null | Error;
  isCheckoutStep?: boolean;
  onSave?: (cents: number) => void;
  showSave?: boolean;
};

type State = {
  initialValue: number;
  value: number;
};

class OnDemandSummary extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    withHeader: true,
    withPanel: true,
  };

  constructor(props: Readonly<Props>) {
    super(props);

    const value = coerceValue(props.value);
    this.state = {
      initialValue: value,
      value,
    };
  }

  parseValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    this.setValue(value);
  };

  setValue(value: number) {
    const {changeOnDemand} = this.props;

    value = Math.max(value, 0);
    this.setState({value});

    const cents = value * 100;
    changeOnDemand?.(cents);
  }

  onSave = (
    e: React.FormEvent<HTMLFormElement> | React.MouseEvent<Element, MouseEvent>
  ) => {
    const {value} = this.state;
    const {onSave} = this.props;

    e?.preventDefault();

    const cents = value * 100;
    onSave?.(cents);

    this.setState({initialValue: value});
  };

  renderLabel = () => {
    const {planDetails} = this.props.subscription;
    return (
      <Label>
        {tct('[budgetTerm] Max Spend', {
          budgetTerm: displayBudgetName(planDetails, {title: true}),
        })}
        <Tooltip
          title={tct(
            `[budgetTerm] spend allows you to pay for additional data beyond your subscription's
  reserved event volume. Billed monthly at the end of the usage period.`,
            {
              budgetTerm: displayBudgetName(planDetails, {title: true}),
            }
          )}
        >
          <LinkButton
            priority="link"
            href="https://docs.sentry.io/pricing/legacy-pricing/#on-demand-volume"
            icon={<IconQuestion size="xs" />}
            size="sm"
            external
            aria-label={t('Visit docs')}
          />
        </Tooltip>
      </Label>
    );
  };

  renderNotEnabled() {
    const {organization} = this.props;
    const {planDetails} = this.props.subscription;

    return (
      <FieldGroup
        label={this.renderLabel()}
        help={tct('[budgetTerm] is not supported for your account.', {
          budgetTerm: displayBudgetName(planDetails, {title: true}),
        })}
      >
        <div>
          <LinkButton to={`/settings/${organization.slug}/support/`}>
            {t('Contact Support')}
          </LinkButton>
        </div>
      </FieldGroup>
    );
  }

  renderNeedsPaymentSource() {
    const {organization, subscription} = this.props;
    const {planDetails} = subscription;

    return (
      <FieldGroup
        label={this.renderLabel()}
        help={tct(
          "To enable [budgetTerm] spend, you'll need a valid credit card on file.",
          {
            budgetTerm: displayBudgetName(planDetails),
          }
        )}
      >
        <div>
          <Button
            priority="primary"
            data-test-id="add-cc-card"
            onClick={() =>
              openEditCreditCard({
                organization,
                subscription,
                onSuccess: (data: Subscription) => {
                  SubscriptionStore.set(organization.slug, data);
                },
              })
            }
          >
            {t('Add Credit Card')}
          </Button>
        </div>
      </FieldGroup>
    );
  }

  renderOnDemandInput() {
    const {subscription, pricePerEvent} = this.props;
    const {value} = this.state;

    const events = Math.trunc((value * 100) / pricePerEvent);
    const oxfordCategories = listDisplayNames({
      plan: subscription.planDetails,
      categories: subscription.planDetails.categories,
    });

    return (
      <OnDemandField
        label={this.renderLabel()}
        help={
          <OnDemandAmount>
            {hasPerformance(subscription.planDetails)
              ? t('Applies to %s.', oxfordCategories)
              : tct('Up to [eventsLabel] errors monthly at [eventPrice] per error.', {
                  eventsLabel: events?.toLocaleString(),
                  eventPrice: <OnDemandPrice pricePerEvent={pricePerEvent} />,
                })}
          </OnDemandAmount>
        }
      >
        <Currency>
          <OnDemandInput
            name="onDemandMaxSpend"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={7}
            placeholder="e.g. 50"
            value={value}
            onChange={this.parseValue}
          />
        </Currency>
      </OnDemandField>
    );
  }

  renderBody() {
    const {
      isCheckoutStep,
      hasPaymentSource,
      enabled,
      error,
      withHeader,
      showSave,
      subscription,
    } = this.props;
    const {initialValue, value} = this.state;
    const {planDetails} = subscription;

    if (!enabled) {
      return this.renderNotEnabled();
    }

    if (!hasPaymentSource) {
      return this.renderNeedsPaymentSource();
    }

    return (
      <form className={enabled ? '' : 'disabled'} onSubmit={this.onSave}>
        {withHeader && (
          <PanelHeader>
            {tct('[budgetTerm] Max Spend', {
              budgetTerm: displayBudgetName(planDetails, {title: true}),
            })}
          </PanelHeader>
        )}

        {/* TODO(TS): Type says error might be an object */}
        {error && <PanelAlert type="error">{error as React.ReactNode}</PanelAlert>}
        <StyledPanelBody isCheckoutStep={isCheckoutStep}>
          {this.renderOnDemandInput()}
        </StyledPanelBody>

        {showSave && (
          <StyledPanelFooter>
            <Button
              priority="primary"
              onClick={this.onSave}
              disabled={initialValue === value}
            >
              {t('Save Changes')}
            </Button>
          </StyledPanelFooter>
        )}
      </form>
    );
  }

  render() {
    if (this.props.withPanel) {
      return <Panel>{this.renderBody()}</Panel>;
    }
    return this.renderBody();
  }
}

const StyledPanelBody = styled(PanelBody)<{isCheckoutStep?: boolean}>`
  padding: ${p => (p.isCheckoutStep ? space(3) : space(2))};
  padding-right: 0px;
`;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)} ${space(2)};
  text-align: right;
`;

const Label = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const OnDemandField = styled(FieldGroup)`
  padding: 0;
`;

const Currency = styled('span')`
  &::before {
    padding: 10px 10px 9px;
    position: absolute;
    content: '$';
    color: ${p => p.theme.tokens.content.primary};
    font-size: ${p => p.theme.fontSize.lg};
  }
`;

const OnDemandInput = styled(Input)`
  padding-left: ${space(4)};
  color: ${p => p.theme.tokens.content.primary};
  max-width: 140px;
  height: 36px;
`;

const OnDemandAmount = styled('div')`
  display: grid;
  grid-auto-rows: auto;
  gap: ${space(0.5)};
`;

export default withOrganization(OnDemandSummary);
