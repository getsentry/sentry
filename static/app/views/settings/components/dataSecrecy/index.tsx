import {useEffect, useState} from 'react';
import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import BooleanField, {
  type BooleanFieldProps,
} from 'sentry/components/forms/fields/booleanField';
import DateTimeField, {
  type DateTimeFieldProps,
} from 'sentry/components/forms/fields/dateTimeField';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type WaiverData = {
  access_end: string | null;
  access_start: string | null;
};

export default function DataSecrecy() {
  const api = useApi();
  const organization = useOrganization();

  const [allowAccess, setAllowAccess] = useState(organization.allowSuperuserAccess);
  const [allowDate, setAllowDate] = useState<WaiverData>();
  const [allowDateFormData, setAllowDateFormData] = useState<string>('');

  const {data, refetch} = useApiQuery<WaiverData>(
    [`/organizations/${organization.slug}/data-secrecy/`],
    {
      staleTime: 3000,
      retry: (failureCount, error) => failureCount < 3 && error.status !== 404,
    }
  );

  const hasValidTempAccess =
    allowDate?.access_end && moment().toISOString() < allowDate.access_end;

  useEffect(() => {
    if (data?.access_end) {
      setAllowDate(data);
      // slice it to yyyy-MM-ddThh:mm format (be aware of the timezone)
      const localDate = moment(data.access_end).local();
      setAllowDateFormData(localDate.format('YYYY-MM-DDTHH:mm'));
    }
  }, [data]);

  const updateAllowedAccess = async (value: boolean) => {
    try {
      await api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {allowSuperuserAccess: value},
      });
      setAllowAccess(value);
      addSuccessMessage(t('Successfully updated access.'));
    } catch (error) {
      addErrorMessage(t('Unable to save changes.'));
    }
  };

  const updateTempAccessDate = async () => {
    if (!allowDateFormData) {
      try {
        await api.requestPromise(`/organizations/${organization.slug}/data-secrecy/`, {
          method: 'DELETE',
        });
        setAllowDate({access_start: '', access_end: ''});
        addSuccessMessage(t('Successfully removed temporary access window.'));
      } catch (error) {
        addErrorMessage(t('Unable to remove temporary access window.'));
      }

      return;
    }

    // maintain the standard format of storing the date in UTC
    // even though the api should be able to handle the local time
    const nextData = {
      access_start: moment().utc().toISOString(),
      access_end: moment.tz(allowDateFormData, moment.tz.guess()).utc().toISOString(),
    };

    try {
      await await api.requestPromise(
        `/organizations/${organization.slug}/data-secrecy/`,
        {
          method: 'PUT',
          data: nextData,
        }
      );
      setAllowDate(nextData);
      addSuccessMessage(t('Successfully updated temporary access window.'));
    } catch (error) {
      addErrorMessage(t('Unable to save changes.'));
      setAllowDateFormData('');
    }
    // refetch to get the latest waiver data
    refetch();
  };

  const allowAccessProps: BooleanFieldProps = {
    name: 'allowSuperuserAccess',
    label: t('Allow access to Sentry employees'),
    help: t(
      'Sentry employees will not have access to your organization unless granted permission'
    ),
    'aria-label': t(
      'Sentry employees will not have access to your data unless granted permission'
    ),
    value: allowAccess,
    onBlur: updateAllowedAccess,
  };

  const allowTempAccessProps: DateTimeFieldProps = {
    name: 'allowTemporarySuperuserAccess',
    label: t('Allow temporary access for Sentry employees'),
    help: t(
      'Open a temporary time window for Sentry employees to access your organization'
    ),
    disabled: allowAccess,
    value: allowAccess ? '' : allowDateFormData,
    onBlur: updateTempAccessDate,
    onChange: v => {
      // the picker doesn't like having a datetime string with seconds+ and a timezone,
      // so we remove it -- we will add it back when we save the date
      const formattedDate = v ? moment(v).format('YYYY-MM-DDTHH:mm') : '';
      setAllowDateFormData(formattedDate);
    },
  };

  return (
    <Panel>
      <PanelHeader>{t('Support Access')}</PanelHeader>
      <PanelBody>
        {!allowAccess && (
          <PanelAlert>
            {hasValidTempAccess
              ? tct(`Sentry employees has access to your organization until [date]`, {
                  date: formatDateTime(allowDate?.access_end as string),
                })
              : t('Sentry employees do not have access to your organization')}
          </PanelAlert>
        )}

        <BooleanField {...(allowAccessProps as BooleanFieldProps)} />
        <DateTimeField {...(allowTempAccessProps as DateTimeFieldProps)} />
      </PanelBody>
    </Panel>
  );
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZoneName: 'short',
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
};
