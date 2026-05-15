import {Fragment, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useApi} from 'sentry/utils/useApi';

import {prettyDate} from 'admin/utils';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {isAmEnterprisePlan, isTrialPlan} from 'getsentry/utils/billing';

type SimulationResponse = {
  currentSubscription: {
    billingDayOfMonth: number;
    billingPeriodEnd: string | null;
    billingPeriodStart: string | null;
    contractPeriodEnd: string | null;
    contractPeriodStart: string | null;
    managed: boolean;
    ondemandPeriodEnd: string | null;
    ondemandPeriodStart: string | null;
    plan: string;
    status: string;
    type: number;
  };
  newDates: Record<string, string> | null;
  preview: {
    atPeriodEnd: boolean;
    billedAmount: number;
    creditApplied: number;
    effectiveAt: string;
    invoiceItems: Array<{
      amount: number;
      description: string;
      period_end: string;
      period_start: string;
      quantity: number;
      unitAmount: number;
    }>;
    proratedAmount: number;
  } | null;
  provisioning: {
    atPeriodEnd: boolean | null;
    coterm: boolean | null;
    effectiveAt: string | null;
    refundNeeded: boolean;
    shiftContractDates: boolean;
    softCap: boolean;
  } | null;
  validation: {
    errors: string[];
    status: 'passed' | 'failed';
  };
};

type FormData = {
  acv: string;
  billingType: string;
  comments: string;
  contractEnd: string;
  contractStart: string;
  dealTerms: string;
  plan: string;
  reservedAttachments: string;
  reservedErrors: string;
  reservedTransactions: string;
};

const INITIAL_FORM_DATA: FormData = {
  plan: '',
  contractStart: '',
  contractEnd: '',
  dealTerms: '',
  comments: '',
  billingType: 'invoiced',
  reservedErrors: '',
  reservedTransactions: '',
  reservedAttachments: '',
  acv: '',
};

type Options = {
  billingConfig: BillingConfig | null | undefined;
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
};

type ModalProps = ModalRenderProps & Options;

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function formatBool(value: boolean | null): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return value ? 'Yes' : 'No';
}

function SimulateProvisionModal({
  Header,
  Body,
  Footer,
  closeModal,
  orgId,
  subscription,
  billingConfig,
}: ModalProps) {
  const api = useApi();
  const [formData, setFormData] = useState<FormData>({
    ...INITIAL_FORM_DATA,
    plan: subscription.plan,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provisionablePlans = useMemo(() => {
    if (!billingConfig) {
      return {};
    }
    return billingConfig.planList.reduce<Record<string, Plan>>((acc, plan) => {
      if (
        (isAmEnterprisePlan(plan.id) ||
          plan.id === 'e1' ||
          plan.id === 'mm2_a' ||
          plan.id === 'mm2_b') &&
        !plan.id.endsWith('_ac') &&
        !plan.id.endsWith('_auf') &&
        !isTrialPlan(plan.id) &&
        !plan.isTestPlan
      ) {
        acc[plan.id] = plan;
      }
      return acc;
    }, {});
  }, [billingConfig]);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const postData: Record<string, any> = {
      plan: formData.plan,
      contractStart: formData.contractStart || undefined,
      contractEnd: formData.contractEnd || undefined,
      dealTerms: formData.dealTerms || undefined,
      comments: formData.comments || undefined,
      billingType: formData.billingType,
      reservedErrors: formData.reservedErrors
        ? parseInt(formData.reservedErrors, 10)
        : undefined,
      reservedTransactions: formData.reservedTransactions
        ? parseInt(formData.reservedTransactions, 10)
        : undefined,
      reservedAttachments: formData.reservedAttachments
        ? parseInt(formData.reservedAttachments, 10)
        : undefined,
      customPrice: formData.acv ? parseInt(formData.acv, 10) * 100 : undefined,
    };

    Object.keys(postData).forEach(key => {
      if (postData[key] === undefined) {
        delete postData[key];
      }
    });

    try {
      const response: SimulationResponse = await api.requestPromise(
        `/customers/${orgId}/provision-simulate/`,
        {
          method: 'POST',
          data: postData,
        }
      );
      setResult(response);
    } catch (err: any) {
      const responseJSON = err?.responseJSON;
      if (responseJSON) {
        const messages = Object.entries(responseJSON)
          .map(([key, val]) => {
            const msg = Array.isArray(val) ? val.join(', ') : String(val);
            return `${key}: ${msg}`;
          })
          .join('\n');
        setError(messages || 'An unexpected error occurred.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Fragment>
      <Header>Simulate Provisioning</Header>
      <Body>
        <Alert.Container>
          <Alert variant="info" showIcon={false}>
            This is a simulation — no changes will be made.
          </Alert>
        </Alert.Container>

        <FormSection>
          <SectionHeader>Provisioning Parameters</SectionHeader>
          <FormGrid>
            <FormField>
              <Label htmlFor="sim-plan">Plan</Label>
              <Select
                id="sim-plan"
                value={formData.plan}
                onChange={e => updateField('plan', e.target.value)}
              >
                <option value="">Select a plan…</option>
                {Object.entries(provisionablePlans)
                  .reverse()
                  .map(([id, plan]) => (
                    <option key={id} value={id}>
                      {plan.name} ({id})
                    </option>
                  ))}
              </Select>
            </FormField>

            <FormField>
              <Label htmlFor="sim-billing-type">Billing Type</Label>
              <Select
                id="sim-billing-type"
                value={formData.billingType}
                onChange={e => updateField('billingType', e.target.value)}
              >
                <option value="invoiced">Invoiced</option>
                <option value="credit_card">Credit Card</option>
              </Select>
            </FormField>

            <FormField>
              <Label htmlFor="sim-contract-start">Contract Start Date</Label>
              <Input
                id="sim-contract-start"
                type="date"
                value={formData.contractStart}
                onChange={e => updateField('contractStart', e.target.value)}
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-contract-end">Contract End Date</Label>
              <Input
                id="sim-contract-end"
                type="date"
                value={formData.contractEnd}
                onChange={e => updateField('contractEnd', e.target.value)}
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-deal-terms">Deal Terms</Label>
              <Input
                id="sim-deal-terms"
                type="text"
                value={formData.dealTerms}
                onChange={e => updateField('dealTerms', e.target.value)}
                placeholder='e.g. "Standard", "Enable Soft-cap"'
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-comments">Comments</Label>
              <Input
                id="sim-comments"
                type="text"
                value={formData.comments}
                onChange={e => updateField('comments', e.target.value)}
              />
            </FormField>
          </FormGrid>

          <SectionHeader>Reserved Volumes</SectionHeader>
          <FormGrid>
            <FormField>
              <Label htmlFor="sim-errors">Reserved Errors</Label>
              <Input
                id="sim-errors"
                type="number"
                min="0"
                value={formData.reservedErrors}
                onChange={e => updateField('reservedErrors', e.target.value)}
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-transactions">Reserved Transactions</Label>
              <Input
                id="sim-transactions"
                type="number"
                min="0"
                value={formData.reservedTransactions}
                onChange={e => updateField('reservedTransactions', e.target.value)}
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-attachments">Reserved Attachments</Label>
              <Input
                id="sim-attachments"
                type="number"
                min="0"
                value={formData.reservedAttachments}
                onChange={e => updateField('reservedAttachments', e.target.value)}
              />
            </FormField>

            <FormField>
              <Label htmlFor="sim-acv">Custom Price / ACV ($)</Label>
              <Input
                id="sim-acv"
                type="number"
                min="0"
                value={formData.acv}
                onChange={e => updateField('acv', e.target.value)}
                placeholder="In dollars (converted to cents for API)"
              />
            </FormField>
          </FormGrid>

          <ButtonRow>
            <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Simulating…' : 'Simulate'}
            </Button>
          </ButtonRow>
        </FormSection>

        {isLoading && <LoadingIndicator />}

        {error && (
          <Alert.Container>
            <Alert variant="danger" showIcon>
              <pre>{error}</pre>
            </Alert>
          </Alert.Container>
        )}

        {result && <SimulationResults result={result} />}
      </Body>
      <Footer>
        <Button onClick={closeModal}>Close</Button>
      </Footer>
    </Fragment>
  );
}

function SimulationResults({result}: {result: SimulationResponse}) {
  const {validation, provisioning, newDates, currentSubscription, preview} = result;

  return (
    <ResultsContainer>
      <ResultSection>
        <SectionHeader>Validation</SectionHeader>
        {validation.status === 'passed' ? (
          <StatusBadge passed>PASSED</StatusBadge>
        ) : (
          <Fragment>
            <StatusBadge passed={false}>FAILED</StatusBadge>
            {validation.errors.map((err, i) => (
              <Alert.Container key={i}>
                <Alert variant="danger" showIcon>
                  {err}
                </Alert>
              </Alert.Container>
            ))}
          </Fragment>
        )}
      </ResultSection>

      {provisioning && (
        <ResultSection>
          <SectionHeader>Provisioning Parameters</SectionHeader>
          <DetailsGrid>
            <DetailItem>
              <DetailLabel>Coterm</DetailLabel>
              <DetailValue>{formatBool(provisioning.coterm)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>At Period End</DetailLabel>
              <DetailValue>{formatBool(provisioning.atPeriodEnd)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Effective At</DetailLabel>
              <DetailValue>
                {provisioning.effectiveAt ? prettyDate(provisioning.effectiveAt) : 'N/A'}
              </DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Shift Contract Dates</DetailLabel>
              <DetailValue>{formatBool(provisioning.shiftContractDates)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Soft Cap</DetailLabel>
              <DetailValue>{provisioning.softCap ? 'Enabled' : 'Disabled'}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Refund Needed</DetailLabel>
              <DetailValue>{formatBool(provisioning.refundNeeded)}</DetailValue>
            </DetailItem>
          </DetailsGrid>
        </ResultSection>
      )}

      {newDates && Object.keys(newDates).length > 0 && (
        <ResultSection>
          <SectionHeader>New Contract Dates</SectionHeader>
          <DetailsGrid>
            {Object.entries(newDates).map(([key, value]) => (
              <DetailItem key={key}>
                <DetailLabel>{key}</DetailLabel>
                <DetailValue>{prettyDate(value)}</DetailValue>
              </DetailItem>
            ))}
          </DetailsGrid>
        </ResultSection>
      )}

      <ResultSection>
        <SectionHeader>Current Subscription</SectionHeader>
        <DetailsGrid>
          <DetailItem>
            <DetailLabel>Plan</DetailLabel>
            <DetailValue>{currentSubscription.plan}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Status</DetailLabel>
            <DetailValue>{currentSubscription.status}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Managed</DetailLabel>
            <DetailValue>{formatBool(currentSubscription.managed)}</DetailValue>
          </DetailItem>
          <DetailItem>
            <DetailLabel>Billing Day</DetailLabel>
            <DetailValue>{currentSubscription.billingDayOfMonth}</DetailValue>
          </DetailItem>
          {currentSubscription.contractPeriodStart && (
            <DetailItem>
              <DetailLabel>Contract Period</DetailLabel>
              <DetailValue>
                {prettyDate(currentSubscription.contractPeriodStart)} –{' '}
                {prettyDate(currentSubscription.contractPeriodEnd)}
              </DetailValue>
            </DetailItem>
          )}
          {currentSubscription.billingPeriodStart && (
            <DetailItem>
              <DetailLabel>Billing Period</DetailLabel>
              <DetailValue>
                {prettyDate(currentSubscription.billingPeriodStart)} –{' '}
                {prettyDate(currentSubscription.billingPeriodEnd)}
              </DetailValue>
            </DetailItem>
          )}
        </DetailsGrid>
      </ResultSection>

      {preview && (
        <ResultSection>
          <SectionHeader>Invoice Preview</SectionHeader>
          <DetailsGrid>
            <DetailItem>
              <DetailLabel>Effective At</DetailLabel>
              <DetailValue>{prettyDate(preview.effectiveAt)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>At Period End</DetailLabel>
              <DetailValue>{formatBool(preview.atPeriodEnd)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Billed Amount</DetailLabel>
              <DetailValue>{formatCurrency(preview.billedAmount)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Prorated Amount</DetailLabel>
              <DetailValue>{formatCurrency(preview.proratedAmount)}</DetailValue>
            </DetailItem>
            <DetailItem>
              <DetailLabel>Credit Applied</DetailLabel>
              <DetailValue>{formatCurrency(preview.creditApplied)}</DetailValue>
            </DetailItem>
          </DetailsGrid>

          {preview.invoiceItems.length > 0 && (
            <Fragment>
              <SubSectionHeader>Line Items</SubSectionHeader>
              <InvoiceTable>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                    <th>Period</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.invoiceItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitAmount)}</td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>
                        {prettyDate(item.period_start)} – {prettyDate(item.period_end)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </InvoiceTable>
            </Fragment>
          )}
        </ResultSection>
      )}
    </ResultsContainer>
  );
}

const FormSection = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
`;

const FormGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.lg};
`;

const FormField = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const Label = styled('label')`
  font-weight: 600;
  font-size: ${p => p.theme.font.size.sm};
`;

const Input = styled('input')`
  padding: ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.font.size.md};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};

  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;

const Select = styled('select')`
  padding: ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.font.size.md};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};

  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;

const ButtonRow = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${p => p.theme.space.sm};
`;

const ResultsContainer = styled('div')`
  margin-top: ${p => p.theme.space['2xl']};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding-top: ${p => p.theme.space.lg};
`;

const ResultSection = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const SectionHeader = styled('h5')`
  margin-bottom: ${p => p.theme.space.sm};
`;

const SubSectionHeader = styled('h6')`
  margin-top: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.sm};
`;

const StatusBadge = styled('span')<{passed: boolean}>`
  display: inline-block;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  font-weight: 700;
  font-size: ${p => p.theme.font.size.sm};
  color: white;
  background: ${p => (p.passed ? p.theme.colors.green500 : p.theme.colors.red500)};
`;

const DetailsGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.sm};
`;

const DetailItem = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  align-items: baseline;
`;

const DetailLabel = styled('span')`
  font-weight: 600;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  min-width: 140px;
`;

const DetailValue = styled('span')`
  font-size: ${p => p.theme.font.size.md};
`;

const InvoiceTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  font-size: ${p => p.theme.font.size.sm};

  th,
  td {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
    text-align: left;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  th {
    font-weight: 600;
    color: ${p => p.theme.tokens.content.secondary};
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

export const triggerSimulateProvision = (opts: Options) =>
  openModal(deps => <SimulateProvisionModal {...deps} {...opts} />, {modalCss});
