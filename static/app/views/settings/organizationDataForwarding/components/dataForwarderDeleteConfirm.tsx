import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useDeleteDataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import type {DataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function DataForwarderDeleteConfirm({
  dataForwarder,
  children,
}: {
  children: React.ReactElement<{
    disabled: boolean;
    onClick: (e: React.MouseEvent) => void;
  }>;
  dataForwarder: DataForwarder;
}) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {mutate: deleteDataForwarder} = useDeleteDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder.id},
  });
  return (
    <Access access={['org:write']}>
      <Confirm
        message={t(
          'Are you sure you want to delete this data forwarder? All configuration, both global and project-level will be lost.'
        )}
        confirmText={t('Delete')}
        priority="danger"
        onCancel={() => {
          trackAnalytics('data_forwarding.delete_cancelled', {
            organization,
            provider: dataForwarder.provider,
          });
        }}
        onConfirm={() => {
          deleteDataForwarder({
            dataForwarderId: dataForwarder.id,
            orgSlug: organization.slug,
          });
          trackAnalytics('data_forwarding.delete_confirmed', {
            organization,
            provider: dataForwarder.provider,
          });
          navigate(`/settings/${organization.slug}/data-forwarding/`);
        }}
      >
        {children}
      </Confirm>
    </Access>
  );
}
