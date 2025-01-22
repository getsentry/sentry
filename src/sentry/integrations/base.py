from __future__ import annotations

import abc
import logging
import sys
from collections.abc import Mapping, MutableMapping, Sequence
from enum import Enum, StrEnum
from functools import cached_property
from typing import TYPE_CHECKING, Any, NamedTuple, NoReturn

from rest_framework.exceptions import NotFound
from rest_framework.request import Request

from sentry import audit_log, features
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.identity.services.identity import identity_service
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.models.team import Team
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationSummary,
    organization_service,
)
from sentry.pipeline import PipelineProvider
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.constants import (
    ERR_INTERNAL,
    ERR_UNAUTHORIZED,
    ERR_UNSUPPORTED_RESPONSE_TYPE,
)
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiInvalidRequestError,
    ApiUnauthorized,
    IntegrationError,
    IntegrationFormError,
    UnsupportedResponseType,
)
from sentry.users.models.identity import Identity
from sentry.utils.audit import create_audit_entry, create_system_audit_entry
from sentry.utils.sdk import Scope

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

    from sentry.integrations.services.integration import RpcOrganizationIntegration
    from sentry.integrations.services.integration.model import RpcIntegration

logger = logging.getLogger(__name__)


class IntegrationFeatureNotImplementedError(Exception):
    pass


class FeatureDescription(NamedTuple):
    description: str  # A markdown description of the feature
    featureGate: IntegrationFeatures  # A IntegrationFeature that gates this feature


class IntegrationMetadata(NamedTuple):
    description: str | _StrPromise  # A markdown description of the integration
    features: Sequence[FeatureDescription]  # A list of FeatureDescriptions
    author: str  # The integration author's name
    noun: str | _StrPromise  # The noun used to identify the integration
    issue_url: str  # URL where issues should be opened
    source_url: str  # URL to view the source
    aspects: dict[str, Any]  # A map of integration specific 'aspects' to the aspect config.

    @staticmethod
    def feature_flag_name(f: str | None) -> str | None:
        """
        FeatureDescriptions are set using the IntegrationFeatures constants,
        however we expose them here as mappings to organization feature flags, thus
        we prefix them with `integration`.
        """
        if f is not None:
            return f"integrations-{f}"
        return None

    def asdict(self) -> dict[str, Any]:
        metadata = self._asdict()
        metadata["features"] = [
            {
                "description": f.description.strip(),
                "featureGate": self.feature_flag_name(f.featureGate.value),
            }
            for f in self.features
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


# Integration Types
class IntegrationDomain(StrEnum):
    MESSAGING = "messaging"
    PROJECT_MANAGEMENT = "project_management"
    SOURCE_CODE_MANAGEMENT = "source_code_management"
    ON_CALL_SCHEDULING = "on_call_scheduling"
    IDENTITY = "identity"  # for identity pipelines


class IntegrationProviderSlug(StrEnum):
    SLACK = "slack"
    DISCORD = "discord"
    MSTEAMS = "msteams"
    JIRA = "jira"
    JIRA_SERVER = "jira_server"
    AZURE_DEVOPS = "vsts"
    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    BITBUCKET_SERVER = "bitbucket_server"
    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"


INTEGRATION_TYPE_TO_PROVIDER = {
    IntegrationDomain.MESSAGING: [
        IntegrationProviderSlug.SLACK,
        IntegrationProviderSlug.DISCORD,
        IntegrationProviderSlug.MSTEAMS,
    ],
    IntegrationDomain.PROJECT_MANAGEMENT: [
        IntegrationProviderSlug.JIRA,
        IntegrationProviderSlug.JIRA_SERVER,
    ],
    IntegrationDomain.SOURCE_CODE_MANAGEMENT: [
        IntegrationProviderSlug.GITHUB,
        IntegrationProviderSlug.GITHUB_ENTERPRISE,
        IntegrationProviderSlug.GITLAB,
        IntegrationProviderSlug.BITBUCKET,
        IntegrationProviderSlug.BITBUCKET_SERVER,
        IntegrationProviderSlug.AZURE_DEVOPS,
    ],
    IntegrationDomain.ON_CALL_SCHEDULING: [
        IntegrationProviderSlug.PAGERDUTY,
        IntegrationProviderSlug.OPSGENIE,
    ],
}


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

    _integration_key: str | None = None
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

    metadata: IntegrationMetadata | None = None
    """
    an IntegrationMetadata object, used to provide extra details in the
    configuration interface of the integration.
    """

    integration_cls: type[IntegrationInstallation] | None = None
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

    features: frozenset[IntegrationFeatures] = frozenset()
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
    def integration_key(self) -> str | None:
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
        extra: Any | None = None,
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


class IntegrationInstallation(abc.ABC):
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
        from sentry.integrations.services.integration import integration_service

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
        from sentry.integrations.services.integration import integration_service

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

    def get_dynamic_display_information(self) -> Mapping[str, Any] | None:
        return None

    @abc.abstractmethod
    def get_client(self) -> Any:
        """
        Return an API client for the integration provider

        Use this method if the integration uses a single API key for all
        configurations and usage of the integration.
        """
        raise NotImplementedError

    def get_keyring_client(self, keyid: int | str) -> Any:
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
            scope = Scope.get_isolation_scope()
            scope.set_tag("integration_provider", self.model.get_provider().name)
            scope.set_tag("org_integration_id", self.org_integration.id)
            scope.set_tag("default_auth_id", self.org_integration.default_auth_id)
            raise Identity.DoesNotExist
        return identity

    def error_message_from_json(self, data: Mapping[str, Any]) -> Any:
        return data.get("message", "unknown error")

    def error_fields_from_json(self, data: Mapping[str, Any]) -> Any | None:
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

    def raise_error(self, exc: Exception, identity: Identity | None = None) -> NoReturn:
        if isinstance(exc, ApiUnauthorized):
            raise InvalidIdentity(self.message_from_error(exc), identity=identity).with_traceback(
                sys.exc_info()[2]
            )
        elif isinstance(exc, ApiInvalidRequestError):
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
    def metadata(self) -> dict[str, Any]:
        return self.model.metadata

    def uninstall(self) -> None:
        """
        For integrations that need additional steps for uninstalling
        that are not covered by the deletion task for OrganizationIntegration
        task.
        """

    # NotifyBasicMixin noops

    def notify_remove_external_team(self, external_team: ExternalActor, team: Team) -> None:
        pass


def is_response_success(resp: Any) -> bool:
    if resp.status_code and resp.status_code < 300:
        return True
    return False


def is_response_error(resp: Any) -> bool:
    if not resp.status_code:
        return False
    return resp.status_code >= 400 and resp.status_code != 429 and resp.status_code < 500


def disable_integration(
    buffer: IntegrationRequestBuffer, redis_key: str, integration_id: int | None = None
) -> None:
    from sentry.integrations.services.integration import integration_service

    result = integration_service.organization_contexts(integration_id=integration_id)
    rpc_integration = result.integration
    rpc_org_integrations = result.organization_integrations
    if rpc_integration and rpc_integration.status == ObjectStatus.DISABLED:
        return None

    org = None
    if len(rpc_org_integrations) > 0:
        org_context = organization_service.get_organization_by_id(
            id=rpc_org_integrations[0].organization_id,
            include_projects=False,
            include_teams=False,
        )
        if org_context:
            org = org_context.organization

    extra = {
        "integration_id": integration_id,
        "buffer_record": buffer._get_all_from_buffer(),
    }
    extra["provider"] = "unknown" if rpc_integration is None else rpc_integration.provider
    extra["organization_id"] = (
        "unknown" if len(rpc_org_integrations) == 0 else rpc_org_integrations[0].organization_id
    )

    logger.info(
        "integration.disabled",
        extra=extra,
    )

    if not rpc_integration:
        return None

    if org and (
        (rpc_integration.provider == "slack" and buffer.is_integration_fatal_broken())
        or (rpc_integration.provider == "github")
        or (
            features.has("organizations:gitlab-disable-on-broken", org)
            and rpc_integration.provider == "gitlab"
        )
    ):
        integration_service.update_integration(
            integration_id=rpc_integration.id, status=ObjectStatus.DISABLED
        )
        notify_disable(org, rpc_integration.provider, redis_key)
        buffer.clear()
        create_system_audit_entry(
            organization_id=org.id,
            target_object=org.id,
            event=audit_log.get_event_id("INTEGRATION_DISABLED"),
            data={"provider": rpc_integration.provider},
        )
    return None


def get_integration_types(provider: str):
    types = []
    for integration_type, providers in INTEGRATION_TYPE_TO_PROVIDER.items():
        if provider in providers:
            types.append(integration_type)
    return types
