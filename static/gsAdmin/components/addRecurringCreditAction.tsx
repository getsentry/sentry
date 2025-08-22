import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import {
  CATEGORY_TO_CREDIT_TYPE,
  CENTS_MULTIPLIER,
  CREDIT_TYPE_OPTIONS,
  CreditType,
  EVENT_CATEGORY_OPTIONS,
  RECURRING_CREDIT_LIMITS,
} from 'admin/constants/recurringCredits';
import type {Subscription} from 'getsentry/types';
import {getPlanCategoryName, isByteCategory} from 'getsentry/utils/dataCategory';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

type RecurringCreditFormData = {
  creditType: CreditType;
  periodEnd: string;
  periodStart: string;
  amount?: number;
  category?: DataCategory;
  notes?: string;
  percentage?: number;
  ticketUrl?: string;
};

interface RecurringCreditRequest {
  creditType: CreditType;
  periodEnd: string;
  periodStart: string;
  amount?: number;
  category?: DataCategory;
  notes?: string;
  percentage?: number;
  ticketUrl?: string;
}

interface ApiError {
  message?: string;
  responseJSON?: {
    detail?: string;
    error?: string;
    errors?: Record<string, string[]>;
  };
}

function AddRecurringCreditModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof RecurringCreditFormData, string>>
  >({});
  const [formData, setFormData] = useState<RecurringCreditFormData>({
    creditType: CreditType.DISCOUNT,
    periodStart: new Date().toISOString().split('T')[0] ?? '',
    periodEnd:
      new Date(new Date().setMonth(new Date().getMonth() + 1))
        .toISOString()
        .split('T')[0] ?? '',
  });

  /**
   * Extracts user-friendly error message from API error response
   * @param error - API error object with potential nested error structures
   * @returns Formatted error message string for display to user
   */
  const extractErrorMessage = useCallback((error: ApiError): string => {
    if (error?.responseJSON?.errors) {
      const fieldErrors = Object.entries(error.responseJSON.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      return fieldErrors || 'Validation errors occurred';
    }

    return (
      error?.responseJSON?.detail ||
      error?.responseJSON?.error ||
      error?.message ||
      'Failed to add recurring credit'
    );
  }, []);

  /**
   * Validates individual form fields with real-time feedback
   * @param field - The form field to validate
   * @param value - The current value of the field
   */
  const validateField = useCallback(
    (field: keyof RecurringCreditFormData, value: any) => {
      const newErrors = {...errors};

      switch (field) {
        case 'notes':
          if (value?.trim()) {
            delete newErrors.notes;
          } else {
            newErrors.notes = 'Notes are required';
          }
          break;
        case 'amount':
          if (formData.creditType === CreditType.DISCOUNT) {
            if (!value || value <= 0) {
              newErrors.amount = 'Amount must be greater than 0';
            } else if (value > RECURRING_CREDIT_LIMITS.DISCOUNT_MAX) {
              newErrors.amount = `Amount cannot exceed $${RECURRING_CREDIT_LIMITS.DISCOUNT_MAX.toLocaleString()}`;
            } else {
              delete newErrors.amount;
            }
          }
          break;
        case 'percentage':
          if (formData.creditType === CreditType.PERCENT) {
            if (!value || value <= 0) {
              newErrors.percentage = 'Percentage must be greater than 0';
            } else if (value > RECURRING_CREDIT_LIMITS.PERCENTAGE_MAX) {
              newErrors.percentage = `Percentage cannot exceed ${RECURRING_CREDIT_LIMITS.PERCENTAGE_MAX}%`;
            } else {
              delete newErrors.percentage;
            }
          }
          break;
        default:
          break;
      }

      setErrors(newErrors);
    },
    [errors, formData.creditType]
  );

  const onSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    if (!formData.notes?.trim()) {
      setErrors({...errors, notes: 'Notes are required'});
      addErrorMessage('Please provide notes for this credit');
      return;
    }

    // Validate date range
    const startDate = new Date(formData.periodStart);
    const endDate = new Date(formData.periodEnd);
    if (endDate <= startDate) {
      addErrorMessage('End date must be after start date');
      return;
    }

    // Validate form data based on credit type
    if (formData.creditType === CreditType.DISCOUNT && !formData.amount) {
      setErrors({...errors, amount: 'Amount is required'});
      addErrorMessage('Please enter a discount amount');
      return;
    }
    if (formData.creditType === CreditType.PERCENT && !formData.percentage) {
      setErrors({...errors, percentage: 'Percentage is required'});
      addErrorMessage('Please enter a percentage');
      return;
    }
    if (
      formData.creditType !== CreditType.DISCOUNT &&
      formData.creditType !== CreditType.PERCENT &&
      (!formData.category || !formData.amount)
    ) {
      addErrorMessage('Please select a category and enter an amount');
      return;
    }

    // Prepare API request data with proper typing
    const requestData: RecurringCreditRequest = {
      creditType: formData.creditType,
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      ticketUrl: formData.ticketUrl,
      notes: formData.notes,
    };

    // Add type-specific fields
    if (formData.creditType === CreditType.DISCOUNT) {
      requestData.amount = formData.amount! * CENTS_MULTIPLIER; // Convert to cents
    } else if (formData.creditType === CreditType.PERCENT) {
      requestData.percentage = formData.percentage;
    } else {
      // Event credit - map category to specific credit type
      requestData.category = formData.category;
      requestData.amount = formData.amount;

      if (formData.category) {
        const mappedCreditType = CATEGORY_TO_CREDIT_TYPE[formData.category];
        if (mappedCreditType) {
          requestData.creditType = mappedCreditType;
        }
      }
    }

    setIsSubmitting(true);
    try {
      await api.requestPromise(`/customers/${organization.slug}/recurring-credits/`, {
        method: 'POST',
        data: requestData,
      });
      addSuccessMessage('Recurring credit added successfully');
      closeModal();
      onSuccess();
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      addErrorMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Memoized help text for credit type selection
   * @returns Context-appropriate help text based on selected credit type
   */
  const creditTypeHelp = useMemo(() => {
    switch (formData.creditType) {
      case CreditType.DISCOUNT:
        return 'A fixed dollar amount discount applied each billing period';
      case CreditType.PERCENT:
        return 'A percentage discount applied to the total bill';
      default:
        return 'Credits for specific event types applied each billing period';
    }
  }, [formData.creditType]);

  /**
   * Memoized dynamic help text for amount fields showing preview of credit impact
   * @returns Preview text showing the calculated credit amount and billing cycle
   */
  const amountHelp = useMemo(() => {
    if (formData.creditType === CreditType.DISCOUNT) {
      return `Total discount: $${(formData.amount || 0).toLocaleString()} per month`;
    }
    if (formData.creditType === CreditType.PERCENT) {
      return `Discount: ${formData.percentage || 0}% of total bill`;
    }
    if (formData.category) {
      const categoryName = getPlanCategoryName({
        plan: subscription.planDetails,
        category: formData.category,
        capitalize: false,
      });

      if (isByteCategory(formData.category)) {
        return `${(formData.amount || 0).toLocaleString()} GB of ${categoryName} per month`;
      }
      return `${(formData.amount || 0).toLocaleString()} ${categoryName} per month`;
    }
    return '';
  }, [
    formData.creditType,
    formData.amount,
    formData.percentage,
    formData.category,
    subscription.planDetails,
  ]);

  return (
    <Fragment>
      <Header closeButton>Add Recurring Credit</Header>
      <Body>
        <StyledForm
          onSubmit={onSubmit}
          submitLabel={isSubmitting ? 'Applying...' : 'Apply Recurring Credit'}
          submitDisabled={isSubmitting}
          onCancel={closeModal}
          cancelLabel="Cancel"
        >
          <SelectField
            name="creditType"
            label="Credit Type"
            help={creditTypeHelp}
            options={CREDIT_TYPE_OPTIONS}
            value={
              formData.creditType === CreditType.DISCOUNT ||
              formData.creditType === CreditType.PERCENT
                ? formData.creditType
                : 'event'
            }
            onChange={(value: string) => {
              const newCreditType =
                value === 'event' ? CreditType.ERROR : (value as CreditType);

              // Initialize category when switching to event type
              const updates: Partial<RecurringCreditFormData> = {
                creditType: newCreditType,
              };

              if (value === 'event' && !formData.category) {
                updates.category = DataCategory.ERRORS;
              }

              // Clear type-specific errors when switching
              const newErrors = {...errors};
              delete newErrors.amount;
              delete newErrors.percentage;
              setErrors(newErrors);

              setFormData({...formData, ...updates});
            }}
            required
            disabled={isSubmitting}
            inline={false}
            stacked
            flexibleControlStateSize
            aria-describedby="creditType-help"
          />

          {formData.creditType === CreditType.DISCOUNT && (
            <NumberField
              name="amount"
              label="Discount Amount ($)"
              help={amountHelp}
              error={errors.amount}
              value={formData.amount || 0}
              onChange={(value: number) => {
                const clampedValue = Math.min(
                  RECURRING_CREDIT_LIMITS.DISCOUNT_MAX,
                  Math.max(0, value)
                );
                setFormData({...formData, amount: clampedValue});
                validateField('amount', clampedValue);
              }}
              required
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              min={RECURRING_CREDIT_LIMITS.DISCOUNT_MIN}
              max={RECURRING_CREDIT_LIMITS.DISCOUNT_MAX}
              aria-describedby="amount-help"
              aria-invalid={!!errors.amount}
              aria-errormessage={errors.amount ? 'amount-error' : undefined}
            />
          )}

          {formData.creditType === CreditType.PERCENT && (
            <NumberField
              name="percentage"
              label="Discount Percentage (%)"
              help={amountHelp}
              error={errors.percentage}
              value={formData.percentage || 0}
              onChange={(value: number) => {
                const clampedValue = Math.min(
                  RECURRING_CREDIT_LIMITS.PERCENTAGE_MAX,
                  Math.max(0, value)
                );
                setFormData({...formData, percentage: clampedValue});
                validateField('percentage', clampedValue);
              }}
              required
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              min={RECURRING_CREDIT_LIMITS.PERCENTAGE_MIN}
              max={RECURRING_CREDIT_LIMITS.PERCENTAGE_MAX}
              aria-describedby="percentage-help"
              aria-invalid={!!errors.percentage}
              aria-errormessage={errors.percentage ? 'percentage-error' : undefined}
            />
          )}

          {formData.creditType !== CreditType.DISCOUNT &&
            formData.creditType !== CreditType.PERCENT && (
              <Fragment>
                <SelectField
                  name="category"
                  label="Event Category"
                  help="Select the type of events to credit"
                  options={EVENT_CATEGORY_OPTIONS}
                  value={formData.category}
                  onChange={(value: DataCategory) => {
                    setFormData({...formData, category: value});
                  }}
                  required
                  disabled={isSubmitting}
                  inline={false}
                  stacked
                  flexibleControlStateSize
                  aria-describedby="category-help"
                />

                <NumberField
                  name="eventAmount"
                  label={
                    formData.category && isByteCategory(formData.category)
                      ? 'Amount (GB)'
                      : 'Event Count'
                  }
                  help={amountHelp}
                  value={formData.amount || 0}
                  onChange={(value: number) => {
                    setFormData({...formData, amount: value});
                    validateField('amount', value);
                  }}
                  required
                  disabled={isSubmitting}
                  inline={false}
                  stacked
                  flexibleControlStateSize
                  aria-describedby="eventAmount-help"
                />
              </Fragment>
            )}

          <DurationSection>
            <InputField
              name="periodStart"
              type="date"
              label="Start Date"
              help="When should this recurring credit begin?"
              value={formData.periodStart}
              onChange={(value: string) => {
                setFormData({...formData, periodStart: value});
              }}
              required
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              aria-describedby="periodStart-help"
            />

            <InputField
              name="periodEnd"
              type="date"
              label="End Date"
              help="When should this recurring credit end?"
              value={formData.periodEnd}
              onChange={(value: string) => {
                setFormData({...formData, periodEnd: value});
              }}
              required
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              min={formData.periodStart}
              aria-describedby="periodEnd-help"
            />
          </DurationSection>

          <AuditSection>
            <InputField
              name="ticketUrl"
              type="url"
              label="Ticket URL"
              help="Link to support ticket or agreement"
              value={formData.ticketUrl || ''}
              onChange={(value: string) => {
                setFormData({...formData, ticketUrl: value});
              }}
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              aria-describedby="ticketUrl-help"
            />

            <TextField
              name="notes"
              label="Notes"
              help="Additional context for this credit (required)"
              error={errors.notes}
              value={formData.notes || ''}
              onChange={(value: string) => {
                setFormData({...formData, notes: value});
                validateField('notes', value);
              }}
              required
              disabled={isSubmitting}
              inline={false}
              stacked
              flexibleControlStateSize
              maxLength={RECURRING_CREDIT_LIMITS.NOTES_MAX_LENGTH}
              aria-describedby="notes-help"
              aria-invalid={!!errors.notes}
              aria-errormessage={errors.notes ? 'notes-error' : undefined}
            />
          </AuditSection>
        </StyledForm>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

const addRecurringCreditAction = (opts: Options) => {
  return openModal(deps => <AddRecurringCreditModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
};

export default addRecurringCreditAction;

const StyledForm = styled(Form)`
  margin-top: ${p => p.theme.space.md};
`;

const DurationSection = styled('div')`
  margin: ${p => p.theme.space.md} 0;
`;

const AuditSection = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  padding-top: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.border};
`;
