from __future__ import annotations

import abc
import logging
import sys
from collections import namedtuple
from enum import Enum
from functools import cached_property
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    FrozenSet,
    Mapping,
    MutableMapping,
    NoReturn,
    Optional,
    Sequence,
    Type,
)
from urllib.request import Request

from rest_framework.exceptions import NotFound

from sentry import audit_log
from sentry.exceptions import InvalidIdentity
from sentry.models.identity import Identity
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.integrations.integration import Integration
from sentry.models.team import Team
from sentry.pipeline import PipelineProvider
from sentry.pipeline.views.base import PipelineView
from sentry.services.hybrid_cloud.identity import identity_service
from sentry.services.hybrid_cloud.identity.model import RpcIdentity
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationSummary,
    organization_service,
)
from sentry.shared_integrations.constants import (
    ERR_INTERNAL,
    ERR_UNAUTHORIZED,
    ERR_UNSUPPORTED_RESPONSE_TYPE,
)
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiUnauthorized,
    IntegrationError,
    IntegrationFormError,
    UnsupportedResponseType,
)
from sentry.utils.audit import create_audit_entry
from sentry.utils.sdk import configure_scope

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.integration import RpcOrganizationIntegration
    from sentry.services.hybrid_cloud.integration.model import RpcIntegration

FeatureDescription = namedtuple(
    "FeatureDescription",
    [
        "description",  # A markdown description of the feature
        "featureGate",  # A IntegrationFeature that gates this feature
    ],
)


IntegrationMetadata = namedtuple(
    "IntegrationMetadata",
    [
        "description",  # A markdown description of the integration
        "features",  # A list of FeatureDescriptions
        "author",  # The integration author's name
        "noun",  # The noun used to identify the integration
        "issue_url",  # URL where issues should be opened
        "source_url",  # URL to view the source
        "aspects",  # A map of integration specific 'aspects' to the aspect config.
    ],
)


class IntegrationMetadata(IntegrationMetadata):  # type: ignore
    @staticmethod
    def feature_flag_name(f: Optional[str]) -> Optional[str]:
        """
        FeatureDescriptions are set using the IntegrationFeatures constants,
        however we expose them here as mappings to organization feature flags, thus
        we prefix them with `integration`.
        """
        if f is not None:
            return f"integrations-{f}"
        return None

    def _asdict(self) -> Dict[str, Sequence[Any]]:
        metadata = super()._asdict()
        metadata["features"] = [
            {
                "description": f.description.strip(),
                "featureGate": self.feature_flag_name(f.featureGate.value),
            }
            for f in metadata["features"]
        ]
        return metadata


class IntegrationFeatures(Enum):
    """
    IntegrationFeatures are used for marking supported features on an
    integration. Features are marked on the IntegrationProvider itself, as well
    as used within the FeatureDescription.

    NOTE: Features in this list that are gated by an organization feature flag
    *must* match the suffix of the organization feature flag name.
    """

    ALERT_RULE = "alert-rule"
    CHAT_UNFURL = "chat-unfurl"
    COMMITS = "commits"
    ENTERPRISE_ALERT_RULE = "enterprise-alert-rule"
    ENTERPRISE_INCIDENT_MANAGEMENT = "enterprise-incident-management"
    INCIDENT_MANAGEMENT = "incident-management"
    ISSUE_BASIC = "issue-basic"
    ISSUE_SYNC = "issue-sync"
    MOBILE = "mobile"
    SERVERLESS = "serverless"
    TICKET_RULES = "ticket-rules"
    STACKTRACE_LINK = "stacktrace-link"
    CODEOWNERS = "codeowners"

    # features currently only existing on plugins:
    DATA_FORWARDING = "data-forwarding"
    SESSION_REPLAY = "session-replay"
    DEPLOYMENT = "deployment"


class IntegrationProvider(PipelineProvider, abc.ABC):
    """
    An integration provider describes a third party that can be registered within Sentry.

    The core behavior is simply how to add the integration (the setup
    pipeline), which will likely use a nested pipeline for identity
    authentication, and what kind of configuration is stored.

    This is similar to Sentry's legacy 'plugin' information, except that an
    integration is lives as an instance in the database, and the ``IntegrationProvider``
    class is just a descriptor for how that object functions, and what behavior
    it provides (such as extensions provided).
    """

    _integration_key: Optional[str] = None
    """
    a unique identifier to use when creating the ``Integration`` object.
    Only needed when you want to create the above object with something other
    than ``key``. See: VstsExtensionIntegrationProvider.
    """

    visible = True
    """
    Whether this integration should show up in the list on the Organization
    Integrations page.
    """

    metadata: Optional[IntegrationMetadata] = None
    """
    an IntegrationMetadata object, used to provide extra details in the
    configuration interface of the integration.
    """

    integration_cls: Optional[Type[IntegrationInstallation]] = None
    """an Integration class that will manage the functionality once installed"""

    setup_dialog_config = {"width": 600, "height": 600}
    """configuration for the setup dialog"""

    can_add = True
    """whether or not the integration installation be initiated from Sentry"""

    can_disable = False
    """
    if the integration can be uninstalled in Sentry, set to False
    if True, the integration must be uninstalled from the other platform
    which is uninstalled/disabled via webhook
    """

    needs_default_identity = False
    """
    if the integration has no application-style access token, associate
    the installer's identity to the organization integration
    """

    is_region_restricted: bool = False
    """
    Returns True if each integration installation can only be connected on one region of Sentry at a
    time. It will raise an error if any organization from another region attempts to install it.
    """

    features: FrozenSet[IntegrationFeatures] = frozenset()
    """can be any number of IntegrationFeatures"""

    requires_feature_flag = False
    """if this is hidden without the feature flag"""

    @classmethod
    def get_installation(
        cls, model: RpcIntegration | Integration, organization_id: int, **kwargs: Any
    ) -> IntegrationInstallation:
        if cls.integration_cls is None:
            raise NotImplementedError

        assert isinstance(organization_id, int)
        return cls.integration_cls(model, organization_id, **kwargs)

    @property
    def integration_key(self) -> Optional[str]:
        return self._integration_key or self.key

    def get_logger(self) -> logging.Logger:
        return logging.getLogger(f"sentry.integration.{self.key}")

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Any | None = None,
    ) -> None:
        pass

    def create_audit_log_entry(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        request: Request,
        action: str,
        extra: Optional[Any] = None,
    ) -> None:
        """
        Creates an audit log entry for the newly installed integration.
        """
        if action == "install":
            create_audit_entry(
                request=request,
                organization=organization,
                target_object=integration.id,
                event=audit_log.get_event_id("INTEGRATION_ADD"),
                data={"provider": integration.provider, "name": integration.name},
            )

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        """
        Return a list of ``View`` instances describing this integration's
        configuration pipeline.

        >>> def get_pipeline_views(self):
        >>>    return []
        """
        raise NotImplementedError

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        """
        Given state captured during the setup pipeline, return a dictionary
        of configuration and metadata to store with this integration.

        This data **must not** be specific to an organization, as the
        integration may be shared among multiple organizations.

        This is the ideal place to store metadata like the 'name' or 'url' to
        the relevant entity, or shared API keys.

        This **must** return an 'external_id' attribute.

        This **should** return a 'name' attribute.

        >>> def build_integration(self, state):
        >>>     return {
        >>>         'external_id': state['id'],
        >>>         'name': state['name'],
        >>>         'metadata': {'url': state['url']},
        >>>     }

        This can return the 'expect_exists' flag, and this method  will expect
        that the passed 'external_id' exists and will not attempt to recreate
        or update the integration.

        >>> def build_integration(self, state):
        >>>    return {
        >>>        'external_id': state['id'],
        >>>        'expect_exists': True,
        >>>    }

        """
        raise NotImplementedError

    def setup(self) -> None:
        """
        Executed once Sentry has been initialized at runtime.

        >>> def setup(self):
        >>>     bindings.add('repository.provider', GitHubRepositoryProvider, key='github')
        """

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        return feature in self.features


class IntegrationInstallation:
    """
    An IntegrationInstallation represents an installed integration and manages the
    core functionality of the integration.
    """

    logger = logging.getLogger("sentry.integrations")

    def __init__(self, model: RpcIntegration | Integration, organization_id: int) -> None:
        self.model = model
        self.organization_id = organization_id
        self._org_integration: RpcOrganizationIntegration | None

    @property
    def org_integration(self) -> RpcOrganizationIntegration | None:
        from sentry.services.hybrid_cloud.integration import integration_service

        if not hasattr(self, "_org_integration"):
            self._org_integration = integration_service.get_organization_integration(
                integration_id=self.model.id,
                organization_id=self.organization_id,
            )
        return self._org_integration

    @org_integration.setter
    def org_integration(self, org_integration: RpcOrganizationIntegration) -> None:
        self._org_integration = org_integration

    @cached_property
    def organization(self) -> RpcOrganization:
        organization = organization_service.get(id=self.organization_id)
        if organization is None:
            raise NotFound("organization_id not found")
        return organization

    def get_organization_config(self) -> Sequence[Any]:
        """
        Returns a list of JSONForm configuration object descriptors used to
        configure the integration per-organization. This simply represents the
        configuration structure.

        See the JSONForm react component for structure details.
        """
        return []

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """
        Update the configuration field for an organization integration.
        """
        from sentry.services.hybrid_cloud.integration import integration_service

        if not self.org_integration:
            return

        config = self.org_integration.config
        config.update(data)
        self.org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )

    def get_config_data(self) -> Mapping[str, str]:
        if not self.org_integration:
            return {}
        return self.org_integration.config

    def get_dynamic_display_information(self) -> Optional[Mapping[str, Any]]:
        return None

    def get_client(self) -> Any:
        """
        Return an API client for the integration provider

        Use this method if the integration uses a single API key for all
        configurations and usage of the integration.
        """
        raise NotImplementedError

    def get_keyring_client(self, keyid: str) -> Any:
        """
        Return an API client with a scoped key based on the key_name.

        Use this method if your integration supports a 'keyring' of keys
        like opsgenie or pagerduty.
        """
        raise NotImplementedError

    def get_default_identity(self) -> RpcIdentity:
        """For Integrations that rely solely on user auth for authentication."""
        if self.org_integration is None or self.org_integration.default_auth_id is None:
            raise Identity.DoesNotExist
        identity = identity_service.get_identity(
            filter={"id": self.org_integration.default_auth_id}
        )
        if identity is None:
            with configure_scope() as scope:
                scope.set_tag("integration_provider", self.model.get_provider().name)
                scope.set_tag("org_integration_id", self.org_integration.id)
                scope.set_tag("default_auth_id", self.org_integration.default_auth_id)
            raise Identity.DoesNotExist
        return identity

    def error_message_from_json(self, data: Mapping[str, Any]) -> Any:
        return data.get("message", "unknown error")

    def error_fields_from_json(self, data: Mapping[str, Any]) -> Optional[Any]:
        """
        If we can determine error fields from the response JSON this should
        format and return them, allowing an IntegrationFormError to be raised.
        Return None if no form errors are present.

        Error fields should be in the format: {field: [message]}
        """
        return None

    def message_from_error(self, exc: Exception) -> str:
        if isinstance(exc, ApiUnauthorized):
            return ERR_UNAUTHORIZED
        elif isinstance(exc, ApiHostError):
            return exc.text
        elif isinstance(exc, UnsupportedResponseType):
            return ERR_UNSUPPORTED_RESPONSE_TYPE.format(content_type=exc.content_type)
        elif isinstance(exc, ApiError):
            if exc.json:
                msg = self.error_message_from_json(exc.json) or "unknown error"
            else:
                msg = "unknown error"
            return f"Error Communicating with {self.model.get_provider().name} (HTTP {exc.code}): {msg}"
        else:
            return ERR_INTERNAL

    def raise_error(self, exc: Exception, identity: Optional[Identity] = None) -> NoReturn:
        if isinstance(exc, ApiUnauthorized):
            raise InvalidIdentity(self.message_from_error(exc), identity=identity).with_traceback(
                sys.exc_info()[2]
            )
        elif isinstance(exc, ApiError):
            if exc.json:
                error_fields = self.error_fields_from_json(exc.json)
                if error_fields is not None:
                    raise IntegrationFormError(error_fields).with_traceback(sys.exc_info()[2])

            raise IntegrationError(self.message_from_error(exc)).with_traceback(sys.exc_info()[2])
        elif isinstance(exc, IntegrationError):
            raise
        else:
            self.logger.exception(str(exc))
            raise IntegrationError(self.message_from_error(exc)).with_traceback(sys.exc_info()[2])

    def is_rate_limited_error(self, exc: Exception) -> bool:
        raise NotImplementedError

    @property
    def metadata(self) -> IntegrationMetadata:
        return self.model.metadata

    def uninstall(self) -> None:
        """
        For integrations that need additional steps for uninstalling
        that are not covered by the deletion task for OrganizationIntegration
        task.
        """
        pass

    # NotifyBasicMixin noops

    def notify_remove_external_team(self, external_team: ExternalActor, team: Team) -> None:
        pass

    def remove_notification_settings(self, actor_id: int, provider: str) -> None:
        pass
