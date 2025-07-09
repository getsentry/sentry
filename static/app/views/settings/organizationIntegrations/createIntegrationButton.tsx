import {openCreateNewIntegrationModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {IntegrationView} from 'sentry/utils/analytics/integrations';
import {PlatformEvents} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';

type CreateIntegrationButtonProps = {
  analyticsView: IntegrationView['view'];
};

/**
 * Button to open the modal to create a new public/internal integration (Sentry App)
 */
function CreateIntegrationButton({analyticsView}: CreateIntegrationButtonProps) {
  const organization = useOrganization();
  const permissionTooltipText = t(
    'Manager or Owner permissions are required to create a new integration'
  );

  return (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Button
          size="sm" redesign
          priority="primary"
          disabled={!hasAccess}
          title={hasAccess ? undefined : permissionTooltipText}
          onClick={() => {
            openCreateNewIntegrationModal();
            trackIntegrationAnalytics(PlatformEvents.OPEN_CREATE_MODAL, {
              organization,
              view: analyticsView,
            });
          }}
        >
          {t('Create New Integration')}
        </Button>
      )}
    </Access>
  );
}

export default CreateIntegrationButton;
