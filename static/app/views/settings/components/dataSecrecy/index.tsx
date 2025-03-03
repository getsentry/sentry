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
  accessEnd: string | null;
  accessStart: string | null;
};

export default function DataSecrecy() {
  const api = useApi();
  const organization = useOrganization();

  // state for the allowSuperuserAccess bit field
  const [allowAccess, setAllowAccess] = useState(organization.allowSuperuserAccess);

  // state of the data secrecy waiver
  const [waiver, setWaiver] = useState<WaiverData>();

  // state for the allowDateFormData field
  const [allowDateFormData, setAllowDateFormData] = useState<string>('');

  const {data, refetch} = useApiQuery<WaiverData>(
    [`/organizations/${organization.slug}/data-secrecy/`],
    {
      staleTime: 3000,
      retry: (failureCount, error) => failureCount < 3 && error.status !== 404,
    }
  );

  useEffect(() => {
    if (data?.accessEnd) {
      setWaiver(data);
      // slice it to yyyy-MM-ddThh:mm format (be aware of the timezone)
      const localDate = moment(data.accessEnd).local();
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

      // if the user has allowed access, we need to remove the temporary access window
      // only if there is an existing waiver
      if (value && waiver) {
        await api.requestPromise(`/organizations/${organization.slug}/data-secrecy/`, {
          method: 'DELETE',
        });
        setAllowDateFormData('');
        setWaiver(undefined);
      }
      addSuccessMessage(
        value
          ? waiver
            ? t(
                'Successfully removed temporary access window and allowed support access.'
              )
            : t('Successfully allowed support access.')
          : t('Successfully removed support access.')
      );
    } catch (error) {
      addErrorMessage(t('Unable to save changes.'));
    }

    // refetch to get the latest waiver data
    refetch();
  };

  const updateTempAccessDate = async () => {
    if (!allowDateFormData) {
      try {
        await api.requestPromise(`/organizations/${organization.slug}/data-secrecy/`, {
          method: 'DELETE',
        });
        setWaiver({accessStart: '', accessEnd: ''});
        addSuccessMessage(t('Successfully removed temporary access window.'));
      } catch (error) {
        addErrorMessage(t('Unable to remove temporary access window.'));
      }

      return;
    }

    // maintain the standard format of storing the date in UTC
    // even though the api should be able to handle the local time
    const nextData: WaiverData = {
      accessStart: moment().utc().toISOString(),
      accessEnd: moment.tz(allowDateFormData, moment.tz.guess()).utc().toISOString(),
    };

    try {
      await api.requestPromise(`/organizations/${organization.slug}/data-secrecy/`, {
        method: 'PUT',
        data: nextData,
      });
      setWaiver(nextData);
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
    disabled: !organization.access.includes('org:write'),
    onBlur: updateAllowedAccess,
  };

  const allowTempAccessProps: DateTimeFieldProps = {
    name: 'allowTemporarySuperuserAccess',
    label: t('Allow temporary access to Sentry employees'),
    help: t(
      'Open a temporary time window for Sentry employees to access your organization'
    ),
    // disable the field if the user has allowed access or if the user does not have org:write access
    disabled: allowAccess || !organization.access.includes('org:write'),
    disabledReason: allowAccess
      ? t('Disable permanent access first to set temporary access')
      : !organization.access.includes('org:write')
        ? t('You do not have permission to modify access settings')
        : undefined,
    value: allowDateFormData,
    onBlur: updateTempAccessDate,
    onChange: (v: any) => {
      // Don't allow the user to set the date if they have allowed access
      if (allowAccess) {
        return;
      }
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
          <PanelAlert type="info">
            {waiver?.accessEnd && moment().isBefore(moment(waiver.accessEnd))
              ? tct(`Sentry employees has access to your organization until [date]`, {
                  date: formatDateTime(waiver?.accessEnd),
                })
              : t('Sentry employees do not have access to your organization')}
          </PanelAlert>
        )}

        <BooleanField {...allowAccessProps} />
        <DateTimeField {...allowTempAccessProps} />
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
