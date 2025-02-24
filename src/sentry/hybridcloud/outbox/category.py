from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from enum import IntEnum
from typing import TYPE_CHECKING, Any, cast

from sentry.hybridcloud.outbox.signals import process_control_outbox, process_region_outbox

if TYPE_CHECKING:
    from sentry.db.models import BaseModel
    from sentry.hybridcloud.models.outbox import ControlOutboxBase, RegionOutboxBase
    from sentry.hybridcloud.outbox.base import HasControlReplicationHandlers, ReplicatedRegionModel

_outbox_categories_for_scope: dict[int, set[OutboxCategory]] = {}
_used_categories: set[OutboxCategory] = set()


class OutboxCategory(IntEnum):
    USER_UPDATE = 0
    WEBHOOK_PROXY = 1
    ORGANIZATION_UPDATE = 2
    ORGANIZATION_MEMBER_UPDATE = 3
    UNUSED_TWO = 4
    AUDIT_LOG_EVENT = 5
    USER_IP_EVENT = 6
    INTEGRATION_UPDATE = 7
    PROJECT_UPDATE = 8
    API_APPLICATION_UPDATE = 9
    SENTRY_APP_INSTALLATION_UPDATE = 10
    TEAM_UPDATE = 11
    ORGANIZATION_INTEGRATION_UPDATE = 12
    UNUSUED_THREE = 13
    SEND_SIGNAL = 14
    ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE = 15
    ORGAUTHTOKEN_UPDATE_USED = 16
    PROVISION_ORGANIZATION = 17
    POST_ORGANIZATION_PROVISION = 18
    UNUSED_ONE = 19
    # No longer in use.
    DISABLE_AUTH_PROVIDER = 20
    RESET_IDP_FLAGS = 21
    MARK_INVALID_SSO = 22
    SUBSCRIPTION_UPDATE = 23

    AUTH_PROVIDER_UPDATE = 24
    AUTH_IDENTITY_UPDATE = 25
    ORGANIZATION_MEMBER_TEAM_UPDATE = 26
    ORGANIZATION_SLUG_RESERVATION_UPDATE = 27
    API_KEY_UPDATE = 28
    PARTNER_ACCOUNT_UPDATE = 29
    SENTRY_APP_UPDATE = 30
    UNUSED_FOUR = 31
    API_TOKEN_UPDATE = 32
    ORG_AUTH_TOKEN_UPDATE = 33
    ISSUE_COMMENT_UPDATE = 34
    EXTERNAL_ACTOR_UPDATE = 35

    RELOCATION_EXPORT_REQUEST = 36
    RELOCATION_EXPORT_REPLY = 37

    SEND_VERCEL_INVOICE = 38

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, int]]:
        return [(i.value, i.value) for i in cls]

    def connect_region_model_updates(self, model: type[ReplicatedRegionModel]) -> None:
        def receiver(
            object_identifier: int,
            payload: Mapping[str, Any] | None,
            shard_identifier: int,
            *args: Any,
            **kwds: Any,
        ) -> None:
            from sentry.receivers.outbox import maybe_process_tombstone

            maybe_instance: ReplicatedRegionModel | None = maybe_process_tombstone(
                cast(Any, model), object_identifier, region_name=None
            )
            if maybe_instance is None:
                model.handle_async_deletion(
                    identifier=object_identifier, shard_identifier=shard_identifier, payload=payload
                )
            else:
                maybe_instance.handle_async_replication(shard_identifier=shard_identifier)

        process_region_outbox.connect(receiver, weak=False, sender=self)

    def connect_control_model_updates(self, model: type[HasControlReplicationHandlers]) -> None:
        def receiver(
            object_identifier: int,
            payload: Mapping[str, Any] | None,
            shard_identifier: int,
            region_name: str,
            *args: Any,
            **kwds: Any,
        ) -> None:
            from sentry.receivers.outbox import maybe_process_tombstone

            maybe_instance: HasControlReplicationHandlers | None = maybe_process_tombstone(
                cast(Any, model), object_identifier, region_name=region_name
            )
            if maybe_instance is None:
                model.handle_async_deletion(
                    identifier=object_identifier,
                    region_name=region_name,
                    shard_identifier=shard_identifier,
                    payload=payload,
                )
            else:
                maybe_instance.handle_async_replication(
                    shard_identifier=shard_identifier, region_name=region_name
                )

        process_control_outbox.connect(receiver, weak=False, sender=self)

    def get_scope(self) -> OutboxScope:
        for scope_int, categories in _outbox_categories_for_scope.items():
            if self not in categories:
                continue
            break
        else:
            raise KeyError
        return OutboxScope(scope_int)

    def as_region_outbox(
        self,
        model: Any | None = None,
        payload: dict[str, Any] | None = None,
        shard_identifier: int | None = None,
        object_identifier: int | None = None,
        outbox: type[RegionOutboxBase] | None = None,
    ) -> RegionOutboxBase:
        from sentry.hybridcloud.models.outbox import RegionOutbox

        scope = self.get_scope()

        shard_identifier, object_identifier = self.infer_identifiers(
            scope, model, object_identifier=object_identifier, shard_identifier=shard_identifier
        )

        Outbox = outbox or RegionOutbox

        return Outbox(
            shard_scope=scope,
            shard_identifier=shard_identifier,
            category=self,
            object_identifier=object_identifier,
            payload=payload,
        )

    def as_control_outboxes(
        self,
        region_names: Collection[str],
        model: Any | None = None,
        payload: dict[str, Any] | None = None,
        shard_identifier: int | None = None,
        object_identifier: int | None = None,
        outbox: type[ControlOutboxBase] | None = None,
    ) -> list[ControlOutboxBase]:
        from sentry.hybridcloud.models.outbox import ControlOutbox

        scope = self.get_scope()

        shard_identifier, object_identifier = self.infer_identifiers(
            scope, model, object_identifier=object_identifier, shard_identifier=shard_identifier
        )

        Outbox = outbox or ControlOutbox

        return [
            Outbox(
                shard_scope=scope,
                shard_identifier=shard_identifier,
                category=self,
                object_identifier=object_identifier,
                region_name=region_name,
                payload=payload,
            )
            for region_name in region_names
        ]

    def infer_identifiers(
        self,
        scope: OutboxScope,
        model: BaseModel | None,
        *,
        object_identifier: int | None,
        shard_identifier: int | None,
    ) -> tuple[int, int]:
        from sentry.integrations.models.integration import Integration
        from sentry.models.apiapplication import ApiApplication
        from sentry.models.organization import Organization
        from sentry.users.models.user import User

        assert (model is not None) ^ (
            object_identifier is not None
        ), "Either model or object_identifier must be specified"

        if model is not None and hasattr(model, "id"):
            object_identifier = model.id

        if shard_identifier is None and model is not None:
            if scope == OutboxScope.ORGANIZATION_SCOPE:
                if isinstance(model, Organization):
                    shard_identifier = model.id
                elif hasattr(model, "organization_id"):
                    shard_identifier = model.organization_id
                elif hasattr(model, "auth_provider"):
                    shard_identifier = model.auth_provider.organization_id
            if scope == OutboxScope.USER_SCOPE:
                if isinstance(model, User):
                    shard_identifier = model.id
                elif hasattr(model, "user_id"):
                    shard_identifier = model.user_id
            if scope == OutboxScope.APP_SCOPE:
                if isinstance(model, ApiApplication):
                    shard_identifier = model.id
                elif hasattr(model, "api_application_id"):
                    shard_identifier = model.api_application_id
            if scope == OutboxScope.INTEGRATION_SCOPE:
                if isinstance(model, Integration):
                    shard_identifier = model.id
                elif hasattr(model, "integration_id"):
                    shard_identifier = model.integration_id

        assert (
            model is not None
        ) or shard_identifier is not None, "Either model or shard_identifier must be specified"

        assert object_identifier is not None
        assert shard_identifier is not None
        return shard_identifier, object_identifier


def scope_categories(enum_value: int, categories: set[OutboxCategory]) -> int:
    _outbox_categories_for_scope[enum_value] = categories
    inter = _used_categories.intersection(categories)
    assert not inter, f"OutboxCategories {inter} were already registered to a different scope"
    _used_categories.update(categories)
    return enum_value


class OutboxScope(IntEnum):
    ORGANIZATION_SCOPE = scope_categories(
        0,
        {
            OutboxCategory.ORGANIZATION_MEMBER_UPDATE,
            OutboxCategory.MARK_INVALID_SSO,
            OutboxCategory.RESET_IDP_FLAGS,
            OutboxCategory.ORGANIZATION_UPDATE,
            OutboxCategory.PROJECT_UPDATE,
            OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE,
            OutboxCategory.SEND_SIGNAL,
            OutboxCategory.ORGAUTHTOKEN_UPDATE_USED,
            OutboxCategory.POST_ORGANIZATION_PROVISION,
            OutboxCategory.DISABLE_AUTH_PROVIDER,
            OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE,
            OutboxCategory.TEAM_UPDATE,
            OutboxCategory.AUTH_PROVIDER_UPDATE,
            OutboxCategory.ORGANIZATION_MEMBER_TEAM_UPDATE,
            OutboxCategory.API_KEY_UPDATE,
            OutboxCategory.ORGANIZATION_SLUG_RESERVATION_UPDATE,
            OutboxCategory.ORG_AUTH_TOKEN_UPDATE,
            OutboxCategory.PARTNER_ACCOUNT_UPDATE,
            OutboxCategory.UNUSED_FOUR,
            OutboxCategory.ISSUE_COMMENT_UPDATE,
            OutboxCategory.SEND_VERCEL_INVOICE,
        },
    )
    USER_SCOPE = scope_categories(
        1,
        {
            OutboxCategory.USER_UPDATE,
            OutboxCategory.API_TOKEN_UPDATE,
            OutboxCategory.UNUSED_ONE,
            OutboxCategory.UNUSED_TWO,
            OutboxCategory.UNUSUED_THREE,
            OutboxCategory.AUTH_IDENTITY_UPDATE,
        },
    )
    WEBHOOK_SCOPE = scope_categories(2, {OutboxCategory.WEBHOOK_PROXY})
    AUDIT_LOG_SCOPE = scope_categories(3, {OutboxCategory.AUDIT_LOG_EVENT})
    USER_IP_SCOPE = scope_categories(
        4,
        {
            OutboxCategory.USER_IP_EVENT,
        },
    )
    INTEGRATION_SCOPE = scope_categories(
        5,
        {OutboxCategory.INTEGRATION_UPDATE, OutboxCategory.EXTERNAL_ACTOR_UPDATE},
    )
    APP_SCOPE = scope_categories(
        6,
        {
            OutboxCategory.API_APPLICATION_UPDATE,
            OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE,
            OutboxCategory.SENTRY_APP_UPDATE,
        },
    )
    # Deprecate?
    TEAM_SCOPE = scope_categories(
        7,
        set(),
    )
    PROVISION_SCOPE = scope_categories(
        8,
        {
            OutboxCategory.PROVISION_ORGANIZATION,
        },
    )
    SUBSCRIPTION_SCOPE = scope_categories(9, {OutboxCategory.SUBSCRIPTION_UPDATE})
    RELOCATION_SCOPE = scope_categories(
        10, {OutboxCategory.RELOCATION_EXPORT_REQUEST, OutboxCategory.RELOCATION_EXPORT_REPLY}
    )

    def __str__(self) -> str:
        return self.name

    @classmethod
    def scope_has_category(cls, shard_scope: int, category: int) -> bool:
        return OutboxCategory(category) in _outbox_categories_for_scope[shard_scope]

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, int]]:
        return [(i.value, i.value) for i in cls]

    @staticmethod
    def get_tag_name(scope: OutboxScope) -> str:
        if scope == OutboxScope.ORGANIZATION_SCOPE:
            return "organization_id"
        if scope == OutboxScope.USER_SCOPE:
            return "user_id"
        if scope == OutboxScope.APP_SCOPE:
            return "app_id"

        return "shard_identifier"


_missing_categories = set(OutboxCategory) - _used_categories
assert (
    not _missing_categories
), f"OutboxCategories {_missing_categories} not registered to an OutboxScope"


class WebhookProviderIdentifier(IntEnum):
    SLACK = 0
    GITHUB = 1
    JIRA = 2
    GITLAB = 3
    MSTEAMS = 4
    BITBUCKET = 5
    VSTS = 6
    JIRA_SERVER = 7
    GITHUB_ENTERPRISE = 8
    BITBUCKET_SERVER = 9
    LEGACY_PLUGIN = 10
    GETSENTRY = 11
    DISCORD = 12
    VERCEL = 13
    GOOGLE = 14
