import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Text from 'sentry/components/text';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type WaiverData = {
  access_end: string | null;
  access_start: string | null;
};

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

const formatDateForInput = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().slice(0, 16);
};

const getWaiverStatus = (waiverData: WaiverData | null) => {
  if (!waiverData || !waiverData.access_start || !waiverData.access_end) {
    return {
      status: t('Data secrecy is not currently waived'),
      isPast: false,
      isFuture: false,
      isCurrentlyWaived: false,
    };
  }

  const now = new Date();
  const startDate = new Date(waiverData.access_start);
  const endDate = new Date(waiverData.access_end);

  if (startDate <= now && endDate > now) {
    return {
      status: tct('Data secrecy is currently waived until [to]', {
        to: <strong>{formatDateTime(waiverData.access_end)}</strong>,
      }),
      isPast: false,
      isFuture: false,
      isCurrentlyWaived: true,
    };
  }
  if (startDate > now) {
    return {
      status: tct('Data secrecy will be waived from [from] until [to]', {
        from: <strong>{formatDateTime(waiverData.access_start)}</strong>,
        to: <strong>{formatDateTime(waiverData.access_end)}</strong>,
      }),
      isPast: false,
      isFuture: true,
      isCurrentlyWaived: false,
    };
  }

  return {
    status: tct('Data secrecy was waived [from] until [to]', {
      from: <strong>{formatDateTime(waiverData.access_start)}</strong>,
      to: <strong>{formatDateTime(waiverData.access_end)}</strong>,
    }),
    isPast: true,
    isFuture: false,
    isCurrentlyWaived: false,
  };
};

export function DataSecrecy() {
  const api = useApi();
  const organization = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [waiverData, setWaiverData] = useState<WaiverData | null>(null);

  const {
    isLoading,
    data,
    refetch,
    error: queryError,
  } = useApiQuery<WaiverData>([`/organizations/${organization.slug}/data-secrecy/`], {
    staleTime: 3000,
    retry: (failureCount, error) => failureCount < 3 && error.status !== 404,
  });

  useEffect(() => {
    if (data) {
      setWaiverData(data);
    }
  }, [data]);

  const initialData = {
    access_start:
      formatDateForInput(waiverData?.access_start) ||
      formatDateForInput(new Date().toISOString()),
    access_end: formatDateForInput(waiverData?.access_end) || '',
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (queryError && queryError.status !== 404) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleSubmit = async formData => {
    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/data-secrecy/`,
        {
          method: 'PUT',
          data: {
            access_start: new Date(formData.access_start || '').toISOString(),
            access_end: new Date(formData.access_end || '').toISOString(),
          },
        }
      );

      setWaiverData(response);
      addSuccessMessage(t('Successfully updated data secrecy waiver'));
      setIsEditing(false);
    } catch (error) {
      addErrorMessage(t('Unable to update data secrecy waiver'));
    }
  };

  const handleDelete = async () => {
    try {
      await api.requestPromise(`/organizations/${organization.slug}/data-secrecy/`, {
        method: 'DELETE',
      });

      setWaiverData(null);
      addSuccessMessage(t('Successfully removed data secrecy waiver'));
    } catch (error) {
      addErrorMessage(t('Unable to remove data secrecy waiver'));
    }
  };

  const waiverStatus = getWaiverStatus(waiverData);
  const showWaiver = !waiverStatus.isPast;
  const showRemoveButton = waiverStatus.isCurrentlyWaived || waiverStatus.isFuture;

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Data Secrecy Waiver')}
        {!isEditing && showWaiver && !organization.allowSuperuserAccess && (
          <PanelAction>
            <React.Fragment>
              {showRemoveButton && (
                <Confirm
                  onConfirm={handleDelete}
                  message={t('Are you sure you want to remove the data secrecy waiver?')}
                >
                  <Button priority="danger" size="sm">
                    {t('Remove Waiver')}
                  </Button>
                </Confirm>
              )}
              <Button priority="primary" size="sm" onClick={() => setIsEditing(true)}>
                {waiverStatus.isCurrentlyWaived || waiverStatus.isFuture
                  ? t('Edit')
                  : t('Add Waiver')}
              </Button>
            </React.Fragment>
          </PanelAction>
        )}
      </PanelHeader>
      {organization.allowSuperuserAccess ? (
        <PanelAlert type="warning">
          {t(
            'Superuser access is currently enabled. To turn superuser access off, toggle the setting above.'
          )}
        </PanelAlert>
      ) : (
        <PanelAlert type="info">
          {t(
            'Data secrecy waiver allows Sentry employees to access the organization temporarily to address issues.'
          )}
        </PanelAlert>
      )}
      {!organization.allowSuperuserAccess && (
        <StyledPanelBody>
          {isEditing ? (
            <Form
              data-test-id="data-secrecy-organization-settings"
              allowUndo
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={() => setIsEditing(false)}
            >
              <JsonForm
                fields={[
                  {
                    name: 'access_start',
                    type: 'datetime',
                    label: t('Waiver Start Time'),
                    required: true,
                  },
                  {
                    name: 'access_end',
                    type: 'datetime',
                    label: t('Waiver End Time'),
                    required: true,
                  },
                ]}
              />
            </Form>
          ) : (
            <Text>{waiverStatus.status}</Text>
          )}
        </StyledPanelBody>
      )}
    </Panel>
  );
}

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
`;
