import {Fragment, useEffect, useRef, useState} from 'react';
import upperFirst from 'lodash/upperFirst';
import moment from 'moment-timezone';

import NumberField from 'sentry/components/forms/fields/numberField';

import type {
  AdminConfirmParams,
  AdminConfirmRenderProps,
} from 'admin/components/adminConfirmationModal';
import type {ProductTrial} from 'getsentry/types';

type Props = AdminConfirmRenderProps & {
  activeProductTrial: ProductTrial;
  apiName: string;
  trialName: string;
};

/**
 * Rendered as part of an openAdminConfirmModal call for extending product trials
 */
function ExtendProductTrialAction({
  activeProductTrial,
  apiName,
  trialName,
  onConfirm,
  setConfirmCallback,
  disableConfirmButton,
}: Props) {
  const [extendDays, setExtendDays] = useState(14);

  // Use a ref to access the latest extendDays value in the callback
  // without causing re-renders when the callback is set
  const extendDaysRef = useRef(extendDays);
  extendDaysRef.current = extendDays;

  useEffect(() => {
    setConfirmCallback((params: AdminConfirmParams) => {
      const formattedApiName = upperFirst(apiName);
      onConfirm?.({
        [`extendTrial${formattedApiName}`]: true,
        extendTrialDays: extendDaysRef.current,
        ...params,
      });
    });
    // Only set up the callback once on mount, using ref for latest value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDaysChange = (value: string) => {
    const days = parseInt(value, 10) || 0;
    setExtendDays(days);
    disableConfirmButton(days < 1 || days > 180);
  };

  const currentEndDate = moment.utc(activeProductTrial.endDate);
  const newEndDate = currentEndDate.clone().add(extendDays, 'days');

  return (
    <Fragment>
      <p>
        Extend the <strong>{trialName}</strong> product trial.
      </p>
      <p>
        Current trial ends: <strong>{currentEndDate.format('MMMM Do YYYY')} UTC</strong>
      </p>
      <NumberField
        inline={false}
        stacked
        flexibleControlStateSize
        label="Number of Days to Extend"
        help={
          <Fragment>
            New trial end date: <strong>{newEndDate.format('MMMM Do YYYY')} UTC</strong>
          </Fragment>
        }
        name="extendDays"
        min={1}
        max={180}
        value={extendDays}
        onChange={handleDaysChange}
      />
    </Fragment>
  );
}

export default ExtendProductTrialAction;
