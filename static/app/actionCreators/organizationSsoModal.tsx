import {openModal} from 'sentry/actionCreators/modal';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {getOrganizationSsoLoginUrl} from 'sentry/views/authV2/authLogin/utils';

export function openOrganizationSsoModal({
  onClose,
  organizationSlug,
}: {
  onClose: () => void;
  organizationSlug: string;
}) {
  void import('sentry/views/authV2/authLogin/components/organizationSsoModal')
    .then(({OrganizationSsoModal}) => {
      openModal(
        modalProps => (
          <OrganizationSsoModal
            {...modalProps}
            onUnmount={onClose}
            organizationSlug={organizationSlug}
          />
        ),
        {onClose}
      );
    })
    .catch(() => {
      onClose();
      testableWindowLocation.assign(getOrganizationSsoLoginUrl(organizationSlug));
    });
}
