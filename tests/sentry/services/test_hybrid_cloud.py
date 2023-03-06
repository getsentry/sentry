from collections import deque

from sentry.services.hybrid_cloud import (
    RpcModel,
    UnsetType,
    app,
    auth,
    identity,
    integration,
    log,
    notifications,
    organization,
    organization_mapping,
    tombstone,
    user,
    user_option,
)
from sentry.testutils import TestCase


class RpcModelTest(TestCase):
    INTERFACE_CLASSES = frozenset(
        [
            app.RpcSentryApp,
            app.RpcSentryAppComponent,
            app.RpcSentryAppInstallation,
            app.RpcSentryAppService,
            auth.RpcAuthIdentity,
            auth.RpcAuthProvider,
            auth.RpcAuthProviderFlags,
            auth.RpcAuthState,
            auth.RpcMemberSsoState,
            auth.RpcOrganizationAuthConfig,
            identity.RpcIdentity,
            identity.RpcIdentityProvider,
            integration.RpcIntegration,
            integration.RpcOrganizationIntegration,
            log.AuditLogEvent,
            log.UserIpEvent,
            notifications.RpcNotificationSetting,
            organization.RpcOrganization,
            organization.RpcOrganizationFlags,
            organization.RpcOrganizationInvite,
            organization.RpcOrganizationMember,
            organization.RpcOrganizationMemberFlags,
            organization.RpcOrganizationSummary,
            organization.RpcProject,
            organization.RpcTeam,
            organization.RpcTeamMember,
            organization.RpcUserOrganizationContext,
            organization_mapping.RpcOrganizationMapping,
            organization_mapping.RpcOrganizationMappingUpdate,
            tombstone.RpcTombstone,
            user.RpcAuthenticator,
            user.RpcAvatar,
            user.RpcUser,
            user.RpcUserEmail,
            user_option.RpcUserOption,
        ]
    )

    def test_schema_generation(self):
        for api_type in self.INTERFACE_CLASSES:
            # We're mostly interested in whether an error occurs
            schema = api_type.schema_json()
            assert schema

    def test_interface_class_coverage(self):
        subclasses = set()
        stack = deque([RpcModel])
        while stack:
            next_class = stack.pop()
            if next_class not in subclasses:
                subclasses.add(next_class)
                stack += next_class.__subclasses__()

        subclasses.difference_update({RpcModel, UnsetType})
        uncovered = subclasses.difference(self.INTERFACE_CLASSES)
        assert uncovered == set(), "RpcModel subclasses exist that are not tested"
