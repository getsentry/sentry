from __future__ import annotations

from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, TypedDict, cast

import sentry_sdk
from rest_framework import serializers
from sentry_relay.auth import PublicKey
from sentry_relay.exceptions import RelayError

from sentry import features, onboarding_tasks, quotas, roles
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.project import ProjectSerializerResponse
from sentry.api.serializers.models.role import (
    OrganizationRoleSerializer,
    OrganizationRoleSerializerResponse,
    TeamRoleSerializer,
    TeamRoleSerializerResponse,
)
from sentry.api.serializers.models.team import TeamSerializerResponse
from sentry.api.serializers.types import OrganizationSerializerResponse
from sentry.api.utils import generate_organization_url, generate_region_url
from sentry.app import env
from sentry.auth.access import Access
from sentry.constants import (
    ACCOUNT_RATE_LIMIT_DEFAULT,
    AI_SUGGESTED_SOLUTION,
    ALERTS_MEMBER_WRITE_DEFAULT,
    ATTACHMENTS_ROLE_DEFAULT,
    DEBUG_FILES_ROLE_DEFAULT,
    EVENTS_MEMBER_ADMIN_DEFAULT,
    GITHUB_COMMENT_BOT_DEFAULT,
    JOIN_REQUESTS_DEFAULT,
    PROJECT_RATE_LIMIT_DEFAULT,
    REQUIRE_SCRUB_DATA_DEFAULT,
    REQUIRE_SCRUB_DEFAULTS_DEFAULT,
    REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    RESERVED_ORGANIZATION_SLUGS,
    SAFE_FIELDS_DEFAULT,
    SCRAPE_JAVASCRIPT_DEFAULT,
    SENSITIVE_FIELDS_DEFAULT,
    ObjectStatus,
)
from sentry.dynamic_sampling.tasks.common import get_organization_volume
from sentry.dynamic_sampling.tasks.helpers.sliding_window import get_sliding_window_org_sample_rate
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.utils import convert_crashreport_count
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationonboardingtask import OrganizationOnboardingTask
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import RpcOrganizationAuthConfig, auth_service
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils.http import is_using_customer_domain

_ORGANIZATION_SCOPE_PREFIX = "organizations:"

if TYPE_CHECKING:
    from sentry.api.serializers import UserSerializerResponse, UserSerializerResponseSelf

# A mapping of OrganizationOption keys to a list of frontend features, and functions to apply the feature.
# Enabling feature-flagging frontend components without an extra API call/endpoint to verify
# the OrganizationOption.
OptionFeature = tuple[str, Callable[[OrganizationOption], bool]]
ORGANIZATION_OPTIONS_AS_FEATURES: Mapping[str, list[OptionFeature]] = {
    "sentry:project-rate-limit": [
        ("legacy-rate-limits", lambda opt: True),
    ],
    "sentry:account-rate-limit": [
        ("legacy-rate-limits", lambda opt: True),
    ],
    "quotas:new-spike-protection": [
        ("spike-projections", lambda opt: bool(opt.value)),
        ("project-stats", lambda opt: bool(opt.value)),
    ],
}


class BaseOrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)

    # XXX: Sentry org slugs are different from other resource slugs. See
    # SentrySlugField for the full regex pattern. In short, they differ b/c
    # 1. cannot contain underscores
    # 2. must start with a number or letter
    # 3. cannot end with a dash
    slug = SentrySerializerSlugField(
        org_slug=True,
        max_length=50,
    )

    def validate_slug(self, value: str) -> str:
        # Historically, the only check just made sure there was more than 1
        # character for the slug, but since then, there are many slugs that
        # fit within this new imposed limit. We're not fixing existing, but
        # just preventing new bad values.
        if len(value) < 3:
            raise serializers.ValidationError(
                f'This slug "{value}" is too short. Minimum of 3 characters.'
            )
        if value in RESERVED_ORGANIZATION_SLUGS:
            raise serializers.ValidationError(f'This slug "{value}" is reserved and not allowed.')
        qs = Organization.objects.filter(slug=value)
        if "organization" in self.context:
            qs = qs.exclude(id=self.context["organization"].id)
        if qs.exists():
            raise serializers.ValidationError(f'The slug "{value}" is already in use.')

        contains_whitespace = any(c.isspace() for c in self.initial_data["slug"])
        if contains_whitespace:
            raise serializers.ValidationError(
                f'The slug "{value}" should not contain any whitespace.'
            )
        return value


class TrustedRelaySerializer(serializers.Serializer):
    internal_external = (
        ("name", "name"),
        ("description", "description"),
        ("public_key", "publicKey"),
        ("created", "created"),
        ("last_modified", "lastModified"),
    )

    def to_representation(self, instance: Any) -> dict[str, Any]:
        ret_val = {}
        for internal_key, external_key in TrustedRelaySerializer.internal_external:
            val = instance.get(internal_key)
            if val is not None:
                ret_val[external_key] = val
        return ret_val

    def to_internal_value(self, data: Any) -> dict[str, str]:
        try:
            key_name = data.get("name")
            public_key = data.get("publicKey") or ""
            description = data.get("description")
        except AttributeError:
            raise serializers.ValidationError("Bad structure received for Trusted Relays")

        if key_name is None:
            raise serializers.ValidationError("Relay key info with missing name in Trusted Relays")

        key_name = key_name.strip()

        if len(key_name) == 0:
            raise serializers.ValidationError("Relay key info with empty name in Trusted Relays")

        if len(public_key) == 0:
            raise serializers.ValidationError(
                f"Missing public key for relay key info with name:'{key_name}' in Trusted Relays"
            )

        try:
            PublicKey.parse(public_key)
        except RelayError:
            raise serializers.ValidationError(
                f"Invalid public key for relay key info with name:'{key_name}' in Trusted Relays"
            )

        return {"public_key": public_key, "name": key_name, "description": description}


class ControlSiloOrganizationSerializerResponse(TypedDict):
    # The control silo will not, cannot, should not contain most organization data.
    # Therefore, we need a specialized, limited via of that data.
    id: str
    slug: str
    name: str


class ControlSiloOrganizationSerializer(Serializer):
    def serialize(
        self, obj: RpcOrganizationSummary, attrs: Mapping[str, Any], user: User
    ) -> ControlSiloOrganizationSerializerResponse:
        return dict(
            id=str(obj.id),
            slug=obj.slug,
            name=obj.name,
        )


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[Organization], user: User, **kwargs: Any
    ) -> MutableMapping[Organization, MutableMapping[str, Any]]:
        avatars = {
            a.organization_id: a
            for a in OrganizationAvatar.objects.filter(organization__in=item_list)
        }

        configs_by_org_id: Mapping[int, RpcOrganizationAuthConfig] = {
            config.organization_id: config
            for config in auth_service.get_org_auth_config(
                organization_ids=[o.id for o in item_list]
            )
        }
        auth_providers = self._serialize_auth_providers(configs_by_org_id, item_list, user)

        data: MutableMapping[Organization, MutableMapping[str, Any]] = {}
        for item in item_list:
            data[item] = {
                "avatar": avatars.get(item.id),
                "auth_provider": auth_providers.get(item.id, None),
                "has_api_key": configs_by_org_id[item.id].has_api_key,
            }
        return data

    def _serialize_auth_providers(
        self,
        configs_by_org_id: Mapping[int, RpcOrganizationAuthConfig],
        item_list: Sequence[Organization],
        user: User,
    ) -> Mapping[int, Any]:
        from .auth_provider import AuthProviderSerializer

        auth_provider_serializer = AuthProviderSerializer()
        return {
            o.id: serialize(
                configs_by_org_id[o.id].auth_provider,
                user=user,
                serializer=auth_provider_serializer,
                organization=o,
            )
            for o in item_list
        }

    def serialize(
        self, obj: Organization, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> OrganizationSerializerResponse:
        from sentry import features
        from sentry.features.base import OrganizationFeature

        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
                "avatarUrl": attrs["avatar"].absolute_url(),
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None, "avatarUrl": None}

        status = OrganizationStatus(obj.status)

        # Retrieve all registered organization features
        org_features = [
            feature
            for feature in features.all(feature_type=OrganizationFeature).keys()
            if feature.startswith(_ORGANIZATION_SCOPE_PREFIX)
        ]
        feature_list = set()

        with sentry_sdk.start_span(op="features.check", description="check batch features"):
            # Check features in batch using the entity handler
            batch_features = features.batch_has(org_features, actor=user, organization=obj)

            # batch_has has found some features
            if batch_features:
                for feature_name, active in batch_features.get(
                    f"organization:{obj.id}", {}
                ).items():
                    if active:
                        # Remove organization prefix
                        feature_list.add(feature_name[len(_ORGANIZATION_SCOPE_PREFIX) :])

                    # This feature_name was found via `batch_has`, don't check again using `has`
                    org_features.remove(feature_name)

        with sentry_sdk.start_span(op="features.check", description="check individual features"):
            # Remaining features should not be checked via the entity handler
            for feature_name in org_features:
                if features.has(feature_name, obj, actor=user, skip_entity=True):
                    # Remove the organization scope prefix
                    feature_list.add(feature_name[len(_ORGANIZATION_SCOPE_PREFIX) :])

        # Do not include the onboarding feature if OrganizationOptions exist
        if (
            "onboarding" in feature_list
            and OrganizationOption.objects.filter(organization=obj).exists()
        ):
            feature_list.remove("onboarding")

        # Include api-keys feature if they previously had any api-keys
        if "api-keys" not in feature_list and attrs["has_api_key"]:
            feature_list.add("api-keys")

        # Organization flag features (not provided through the features module)
        options_as_features = OrganizationOption.objects.filter(
            organization=obj, key__in=ORGANIZATION_OPTIONS_AS_FEATURES.keys()
        )
        for option in options_as_features:
            for option_feature, option_function in ORGANIZATION_OPTIONS_AS_FEATURES[option.key]:
                if option_function(option):
                    feature_list.add(option_feature)

        if getattr(obj.flags, "allow_joinleave"):
            feature_list.add("open-membership")
        if not getattr(obj.flags, "disable_shared_issues"):
            feature_list.add("shared-issues")
        request = env.request
        if request and is_using_customer_domain(request):
            # If the current request is using a customer domain, then we activate the feature for this organization.
            feature_list.add("customer-domains")

        if "dynamic-sampling" not in feature_list and "mep-rollout-flag" in feature_list:
            feature_list.remove("mep-rollout-flag")

        has_auth_provider = attrs.get("auth_provider", None) is not None

        context = {
            "id": str(obj.id),
            "slug": obj.slug,
            "status": {"id": status.name.lower(), "name": status.label},
            "name": obj.name or obj.slug,
            "dateCreated": obj.date_added,
            "isEarlyAdopter": bool(obj.flags.early_adopter),
            "require2FA": bool(obj.flags.require_2fa),
            "requireEmailVerification": bool(
                features.has("organizations:required-email-verification", obj)
                and obj.flags.require_email_verification
            ),
            "avatar": avatar,
            "features": feature_list,
            "links": {
                "organizationUrl": generate_organization_url(obj.slug),
                "regionUrl": generate_region_url(),
            },
            "hasAuthProvider": has_auth_provider,
        }

        if "access" in kwargs:
            context["access"] = kwargs["access"].scopes
            tasks_to_serialize = list(onboarding_tasks.fetch_onboarding_tasks(obj, user))
            context["onboardingTasks"] = serialize(tasks_to_serialize, user)

        return context


class _OnboardingTasksAttrs(TypedDict):
    user: UserSerializerResponse | UserSerializerResponseSelf | None


class OnboardingTasksSerializerResponse(TypedDict):

    task: str  # TODO: literal/enum
    status: str  # TODO: literal/enum
    user: UserSerializerResponse | UserSerializerResponseSelf | None
    completionSeen: datetime
    dateCompleted: datetime
    data: Any  # JSON object


@register(OrganizationOnboardingTask)
class OnboardingTasksSerializer(Serializer):
    def get_attrs(
        self, item_list: OrganizationOnboardingTask, user: User, **kwargs: Any
    ) -> MutableMapping[OrganizationOnboardingTask, _OnboardingTasksAttrs]:
        serialized_users = user_service.serialize_many(
            filter={"user_ids": list({item.user_id for item in item_list if item.user_id})}
        )
        user_map = {user["id"]: user for user in serialized_users}

        data: MutableMapping[OrganizationOnboardingTask, _OnboardingTasksAttrs] = {}
        for item in item_list:
            data[item] = {"user": user_map.get(str(item.user_id))}
        return data

    def serialize(
        self, obj: OrganizationOnboardingTask, attrs: _OnboardingTasksAttrs, user: User
    ) -> OnboardingTasksSerializerResponse:
        return {
            "task": OrganizationOnboardingTask.TASK_KEY_MAP.get(obj.task),
            "status": OrganizationOnboardingTask.STATUS_KEY_MAP.get(obj.status),
            "user": attrs.get("user"),
            "completionSeen": obj.completion_seen,
            "dateCompleted": obj.date_completed,
            "data": obj.data,
        }


class _DetailedOrganizationSerializerResponseOptional(OrganizationSerializerResponse, total=False):
    role: Any  # TODO replace with enum/literal
    orgRole: str


class DetailedOrganizationSerializerResponse(_DetailedOrganizationSerializerResponseOptional):
    experiments: Any
    quota: Any
    isDefault: bool
    defaultRole: bool
    availableRoles: list[Any]  # TODO: deprecated, use orgRoleList
    orgRoleList: list[OrganizationRoleSerializerResponse]
    teamRoleList: list[TeamRoleSerializerResponse]
    openMembership: bool
    allowSharedIssues: bool
    enhancedPrivacy: bool
    dataScrubber: bool
    dataScrubberDefaults: bool
    sensitiveFields: list[Any]  # TODO
    safeFields: list[Any]
    storeCrashReports: Any  # TODO
    attachmentsRole: Any  # TODO
    debugFilesRole: str
    eventsMemberAdmin: bool
    alertsMemberWrite: bool
    scrubIPAddresses: bool
    scrapeJavaScript: bool
    allowJoinRequests: bool
    relayPiiConfig: str | None
    trustedRelays: Any  # TODO
    access: frozenset[str]
    pendingAccessRequests: int
    onboardingTasks: OnboardingTasksSerializerResponse
    codecovAccess: bool
    aiSuggestedSolution: bool
    githubPRBot: bool
    githubOpenPRBot: bool
    githubNudgeInvite: bool
    isDynamicallySampled: bool


class DetailedOrganizationSerializer(OrganizationSerializer):
    def get_attrs(
        self, item_list: Sequence[Organization], user: User, **kwargs: Any
    ) -> MutableMapping[Organization, MutableMapping[str, Any]]:
        return super().get_attrs(item_list, user)

    def serialize(  # type: ignore
        self, obj: Organization, attrs: Mapping[str, Any], user: User, access: Access
    ) -> DetailedOrganizationSerializerResponse:
        # TODO: rectify access argument overriding parent if we want to remove above type ignore

        from sentry import experiments

        experiment_assignments = experiments.all(org=obj, actor=user)

        context = cast(
            DetailedOrganizationSerializerResponse,
            super().serialize(obj, attrs, user, access=access),
        )
        max_rate = quotas.get_maximum_quota(obj)
        context["experiments"] = experiment_assignments
        context["quota"] = {
            "maxRate": max_rate[0],
            "maxRateInterval": max_rate[1],
            "accountLimit": int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key="sentry:account-rate-limit",
                    default=ACCOUNT_RATE_LIMIT_DEFAULT,
                )
            ),
            "projectLimit": int(
                OrganizationOption.objects.get_value(
                    organization=obj,
                    key="sentry:project-rate-limit",
                    default=PROJECT_RATE_LIMIT_DEFAULT,
                )
            ),
        }

        context.update(
            {
                "isDefault": obj.is_default,
                "defaultRole": obj.default_role,
                "availableRoles": [
                    {"id": r.id, "name": r.name} for r in roles.get_all()
                ],  # Deprecated
                "orgRoleList": serialize(
                    roles.get_all(), serializer=OrganizationRoleSerializer(organization=obj)
                ),
                "teamRoleList": serialize(
                    roles.team_roles.get_all(), serializer=TeamRoleSerializer(organization=obj)
                ),
                "openMembership": bool(obj.flags.allow_joinleave),
                "require2FA": bool(obj.flags.require_2fa),
                "requireEmailVerification": bool(
                    features.has("organizations:required-email-verification", obj)
                    and obj.flags.require_email_verification
                ),
                "allowSharedIssues": not obj.flags.disable_shared_issues,
                "enhancedPrivacy": bool(obj.flags.enhanced_privacy),
                "dataScrubber": bool(
                    obj.get_option("sentry:require_scrub_data", REQUIRE_SCRUB_DATA_DEFAULT)
                ),
                "dataScrubberDefaults": bool(
                    obj.get_option("sentry:require_scrub_defaults", REQUIRE_SCRUB_DEFAULTS_DEFAULT)
                ),
                "sensitiveFields": obj.get_option(
                    "sentry:sensitive_fields", SENSITIVE_FIELDS_DEFAULT
                )
                or [],
                "safeFields": obj.get_option("sentry:safe_fields", SAFE_FIELDS_DEFAULT) or [],
                "storeCrashReports": convert_crashreport_count(
                    obj.get_option("sentry:store_crash_reports")
                ),
                "attachmentsRole": str(
                    obj.get_option("sentry:attachments_role", ATTACHMENTS_ROLE_DEFAULT)
                ),
                "debugFilesRole": str(
                    obj.get_option("sentry:debug_files_role", DEBUG_FILES_ROLE_DEFAULT)
                ),
                "eventsMemberAdmin": bool(
                    obj.get_option("sentry:events_member_admin", EVENTS_MEMBER_ADMIN_DEFAULT)
                ),
                "alertsMemberWrite": bool(
                    obj.get_option("sentry:alerts_member_write", ALERTS_MEMBER_WRITE_DEFAULT)
                ),
                "scrubIPAddresses": bool(
                    obj.get_option(
                        "sentry:require_scrub_ip_address", REQUIRE_SCRUB_IP_ADDRESS_DEFAULT
                    )
                ),
                "scrapeJavaScript": bool(
                    obj.get_option("sentry:scrape_javascript", SCRAPE_JAVASCRIPT_DEFAULT)
                ),
                "allowJoinRequests": bool(
                    obj.get_option("sentry:join_requests", JOIN_REQUESTS_DEFAULT)
                ),
                "relayPiiConfig": str(obj.get_option("sentry:relay_pii_config") or "") or None,
                "codecovAccess": bool(obj.flags.codecov_access),
                "aiSuggestedSolution": bool(
                    obj.get_option("sentry:ai_suggested_solution", AI_SUGGESTED_SOLUTION)
                ),
                "githubPRBot": bool(
                    obj.get_option("sentry:github_pr_bot", GITHUB_COMMENT_BOT_DEFAULT)
                ),
                "githubOpenPRBot": bool(
                    obj.get_option("sentry:github_open_pr_bot", GITHUB_COMMENT_BOT_DEFAULT)
                ),
                "githubNudgeInvite": bool(
                    obj.get_option("sentry:github_nudge_invite", GITHUB_COMMENT_BOT_DEFAULT)
                ),
            }
        )

        trusted_relays_raw = obj.get_option("sentry:trusted-relays") or []
        # serialize trusted relays info into their external form
        context["trustedRelays"] = [TrustedRelaySerializer(raw).data for raw in trusted_relays_raw]

        if access.role is not None:
            context["role"] = access.role  # Deprecated
            context["orgRole"] = access.role
        context["pendingAccessRequests"] = OrganizationAccessRequest.objects.filter(
            team__organization=obj
        ).count()
        sample_rate = quotas.get_blended_sample_rate(organization_id=obj.id)  # type:ignore
        context["isDynamicallySampled"] = (
            features.has("organizations:dynamic-sampling", obj)
            and sample_rate is not None
            and sample_rate < 1.0
        )
        org_volume = get_organization_volume(obj.id, timedelta(hours=24))
        if org_volume is not None and org_volume.indexed is not None and org_volume.total > 0:
            context["effectiveSampleRate"] = org_volume.indexed / org_volume.total
        desired_sample_rate: float | None = get_sliding_window_org_sample_rate(obj.id)
        if desired_sample_rate is not None:
            context["desiredSampleRate"] = desired_sample_rate

        return context


class DetailedOrganizationSerializerWithProjectsAndTeamsResponse(
    DetailedOrganizationSerializerResponse
):
    teams: list[TeamSerializerResponse]
    projects: list[ProjectSerializerResponse]


class DetailedOrganizationSerializerWithProjectsAndTeams(DetailedOrganizationSerializer):
    def get_attrs(
        self, item_list: Sequence[Organization], user: User, **kwargs: Any
    ) -> MutableMapping[Organization, MutableMapping[str, Any]]:
        return super().get_attrs(item_list, user)

    def _project_list(self, organization: Organization, access: Access) -> list[Project]:
        project_list = list(
            Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).order_by(
                "slug"
            )
        )

        for project in project_list:
            project.set_cached_field_value("organization", organization)

        return project_list

    def _team_list(self, organization: Organization, access: Access) -> list[Team]:
        team_list = list(
            Team.objects.filter(organization=organization, status=TeamStatus.ACTIVE).order_by(
                "slug"
            )
        )

        for team in team_list:
            team.set_cached_field_value("organization", organization)

        return team_list

    def serialize(  # type: ignore
        self, obj: Organization, attrs: Mapping[str, Any], user: User, access: Access
    ) -> DetailedOrganizationSerializerWithProjectsAndTeamsResponse:
        from sentry.api.serializers.models.project import (
            LATEST_DEPLOYS_KEY,
            ProjectSummarySerializer,
        )
        from sentry.api.serializers.models.team import TeamSerializer

        context = cast(
            DetailedOrganizationSerializerWithProjectsAndTeamsResponse,
            super().serialize(obj, attrs, user, access),
        )

        team_list = self._team_list(obj, access)
        project_list = self._project_list(obj, access)

        context["teams"] = serialize(team_list, user, TeamSerializer(access=access))

        collapse_projects: set[str] = set()
        if killswitch_matches_context(
            "api.organization.disable-last-deploys",
            {
                "organization_id": obj.id,
            },
        ):
            collapse_projects = {LATEST_DEPLOYS_KEY}

        context["projects"] = serialize(
            project_list, user, ProjectSummarySerializer(access=access, collapse=collapse_projects)
        )

        return context
