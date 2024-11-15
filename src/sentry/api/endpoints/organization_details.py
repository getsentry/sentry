from __future__ import annotations

import logging
from copy import copy
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from django.db import models, router, transaction
from django.db.models.query_utils import DeferredAttribute
from django.urls import reverse
from django.utils import timezone as django_timezone
from django.utils.functional import cached_property
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_serializer
from rest_framework import serializers, status

from bitfield.types import BitHandler
from sentry import audit_log, roles
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import ONE_DAY, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.endpoints.project_details import MAX_SENSITIVE_FIELD_CHARS
from sentry.api.fields import AvatarField
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.api.serializers.models import organization as org_serializers
from sentry.api.serializers.models.organization import (
    BaseOrganizationSerializer,
    DetailedOrganizationSerializerWithProjectsAndTeams,
    TrustedRelaySerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.auth.services.auth import auth_service
from sentry.auth.staff import is_active_staff
from sentry.constants import (
    ACCOUNT_RATE_LIMIT_DEFAULT,
    AI_SUGGESTED_SOLUTION,
    ALERTS_MEMBER_WRITE_DEFAULT,
    ATTACHMENTS_ROLE_DEFAULT,
    AUTOFIX_ENABLED_DEFAULT,
    DEBUG_FILES_ROLE_DEFAULT,
    EVENTS_MEMBER_ADMIN_DEFAULT,
    GITHUB_COMMENT_BOT_DEFAULT,
    HIDE_AI_FEATURES_DEFAULT,
    ISSUE_ALERTS_THREAD_DEFAULT,
    JOIN_REQUESTS_DEFAULT,
    LEGACY_RATE_LIMIT_OPTIONS,
    METRIC_ALERTS_THREAD_DEFAULT,
    METRICS_ACTIVATE_LAST_FOR_GAUGES_DEFAULT,
    METRICS_ACTIVATE_PERCENTILES_DEFAULT,
    PROJECT_RATE_LIMIT_DEFAULT,
    REQUIRE_SCRUB_DATA_DEFAULT,
    REQUIRE_SCRUB_DEFAULTS_DEFAULT,
    REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    ROLLBACK_ENABLED_DEFAULT,
    SAFE_FIELDS_DEFAULT,
    SAMPLING_MODE_DEFAULT,
    SCRAPE_JAVASCRIPT_DEFAULT,
    SENSITIVE_FIELDS_DEFAULT,
    TARGET_SAMPLE_RATE_DEFAULT,
    UPTIME_AUTODETECTION,
)
from sentry.datascrubbing import validate_pii_config_update, validate_pii_selectors
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import (
    boost_low_volume_projects_of_org_with_query,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.dynamic_sampling.utils import (
    has_custom_dynamic_sampling,
    is_organization_mode_sampling,
    is_project_mode_sampling,
)
from sentry.hybridcloud.rpc import IDEMPOTENCY_KEY_LENGTH
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.lang.native.utils import (
    STORE_CRASH_REPORTS_DEFAULT,
    STORE_CRASH_REPORTS_MAX,
    convert_crashreport_count,
)
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcOrganizationDeleteResponse,
    RpcOrganizationDeleteState,
)
from sentry.services.organization.provisioning import (
    OrganizationSlugCollisionException,
    organization_provisioning_service,
)
from sentry.users.services.user.serial import serialize_generic_user
from sentry.utils.audit import create_audit_entry

ERR_DEFAULT_ORG = "You cannot remove the default organization."
ERR_NO_USER = "This request requires an authenticated user."
ERR_NO_2FA = "Cannot require two-factor authentication without personal two-factor enabled."
ERR_SSO_ENABLED = "Cannot require two-factor authentication with SSO enabled"
ERR_3RD_PARTY_PUBLISHED_APP = "Cannot delete an organization that owns a published integration. Contact support if you need assistance."
ERR_PLAN_REQUIRED = "A paid plan is required to enable this feature."

ORG_OPTIONS = (
    # serializer field name, option key name, type, default value
    (
        "projectRateLimit",
        "sentry:project-rate-limit",
        int,
        PROJECT_RATE_LIMIT_DEFAULT,
    ),
    (
        "accountRateLimit",
        "sentry:account-rate-limit",
        int,
        ACCOUNT_RATE_LIMIT_DEFAULT,
    ),
    ("dataScrubber", "sentry:require_scrub_data", bool, REQUIRE_SCRUB_DATA_DEFAULT),
    ("sensitiveFields", "sentry:sensitive_fields", list, SENSITIVE_FIELDS_DEFAULT),
    ("safeFields", "sentry:safe_fields", list, SAFE_FIELDS_DEFAULT),
    (
        "scrapeJavaScript",
        "sentry:scrape_javascript",
        bool,
        SCRAPE_JAVASCRIPT_DEFAULT,
    ),
    (
        "dataScrubberDefaults",
        "sentry:require_scrub_defaults",
        bool,
        REQUIRE_SCRUB_DEFAULTS_DEFAULT,
    ),
    (
        "storeCrashReports",
        "sentry:store_crash_reports",
        convert_crashreport_count,
        STORE_CRASH_REPORTS_DEFAULT,
    ),
    (
        "attachmentsRole",
        "sentry:attachments_role",
        str,
        ATTACHMENTS_ROLE_DEFAULT,
    ),
    (
        "debugFilesRole",
        "sentry:debug_files_role",
        str,
        DEBUG_FILES_ROLE_DEFAULT,
    ),
    (
        "eventsMemberAdmin",
        "sentry:events_member_admin",
        bool,
        EVENTS_MEMBER_ADMIN_DEFAULT,
    ),
    (
        "alertsMemberWrite",
        "sentry:alerts_member_write",
        bool,
        ALERTS_MEMBER_WRITE_DEFAULT,
    ),
    (
        "scrubIPAddresses",
        "sentry:require_scrub_ip_address",
        bool,
        REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    ),
    ("relayPiiConfig", "sentry:relay_pii_config", str, None),
    ("allowJoinRequests", "sentry:join_requests", bool, JOIN_REQUESTS_DEFAULT),
    ("apdexThreshold", "sentry:apdex_threshold", int, None),
    (
        "aiSuggestedSolution",
        "sentry:ai_suggested_solution",
        bool,
        AI_SUGGESTED_SOLUTION,
    ),
    (
        "hideAiFeatures",
        "sentry:hide_ai_features",
        bool,
        HIDE_AI_FEATURES_DEFAULT,
    ),
    (
        "autofixEnabled",
        "sentry:autofix_enabled",
        bool,
        AUTOFIX_ENABLED_DEFAULT,
    ),
    (
        "githubPRBot",
        "sentry:github_pr_bot",
        bool,
        GITHUB_COMMENT_BOT_DEFAULT,
    ),
    (
        "githubOpenPRBot",
        "sentry:github_open_pr_bot",
        bool,
        GITHUB_COMMENT_BOT_DEFAULT,
    ),
    (
        "githubNudgeInvite",
        "sentry:github_nudge_invite",
        bool,
        GITHUB_COMMENT_BOT_DEFAULT,
    ),
    (
        "issueAlertsThreadFlag",
        "sentry:issue_alerts_thread_flag",
        bool,
        ISSUE_ALERTS_THREAD_DEFAULT,
    ),
    (
        "metricAlertsThreadFlag",
        "sentry:metric_alerts_thread_flag",
        bool,
        METRIC_ALERTS_THREAD_DEFAULT,
    ),
    (
        "metricsActivatePercentiles",
        "sentry:metrics_activate_percentiles",
        bool,
        METRICS_ACTIVATE_PERCENTILES_DEFAULT,
    ),
    (
        "metricsActivateLastForGauges",
        "sentry:metrics_activate_last_for_gauges",
        bool,
        METRICS_ACTIVATE_LAST_FOR_GAUGES_DEFAULT,
    ),
    ("uptimeAutodetection", "sentry:uptime_autodetection", bool, UPTIME_AUTODETECTION),
    ("targetSampleRate", "sentry:target_sample_rate", float, TARGET_SAMPLE_RATE_DEFAULT),
    ("samplingMode", "sentry:sampling_mode", str, SAMPLING_MODE_DEFAULT),
    ("rollbackEnabled", "sentry:rollback_enabled", bool, ROLLBACK_ENABLED_DEFAULT),
)

DELETION_STATUSES = frozenset(
    [OrganizationStatus.PENDING_DELETION, OrganizationStatus.DELETION_IN_PROGRESS]
)

UNSAVED = object()
DEFERRED = object()


class OrganizationSerializer(BaseOrganizationSerializer):
    accountRateLimit = EmptyIntegerField(
        min_value=0, max_value=1000000, required=False, allow_null=True
    )
    projectRateLimit = EmptyIntegerField(
        min_value=50, max_value=100, required=False, allow_null=True
    )
    avatar = AvatarField(required=False, allow_null=True)
    avatarType = serializers.ChoiceField(
        choices=(("upload", "upload"), ("letter_avatar", "letter_avatar")),
        required=False,
        allow_null=True,
    )

    openMembership = serializers.BooleanField(required=False)
    allowSharedIssues = serializers.BooleanField(required=False)
    allowMemberInvite = serializers.BooleanField(required=False)
    allowMemberProjectCreation = serializers.BooleanField(required=False)
    allowSuperuserAccess = serializers.BooleanField(required=False)
    enhancedPrivacy = serializers.BooleanField(required=False)
    dataScrubber = serializers.BooleanField(required=False)
    dataScrubberDefaults = serializers.BooleanField(required=False)
    sensitiveFields = serializers.ListField(child=serializers.CharField(), required=False)
    safeFields = serializers.ListField(child=serializers.CharField(), required=False)
    storeCrashReports = serializers.IntegerField(
        min_value=-1, max_value=STORE_CRASH_REPORTS_MAX, required=False
    )
    attachmentsRole = serializers.CharField(required=True)
    debugFilesRole = serializers.CharField(required=True)
    eventsMemberAdmin = serializers.BooleanField(required=False)
    alertsMemberWrite = serializers.BooleanField(required=False)
    scrubIPAddresses = serializers.BooleanField(required=False)
    scrapeJavaScript = serializers.BooleanField(required=False)
    isEarlyAdopter = serializers.BooleanField(required=False)
    aiSuggestedSolution = serializers.BooleanField(required=False)
    hideAiFeatures = serializers.BooleanField(required=False)
    autofixEnabled = serializers.BooleanField(required=False)
    codecovAccess = serializers.BooleanField(required=False)
    githubOpenPRBot = serializers.BooleanField(required=False)
    githubNudgeInvite = serializers.BooleanField(required=False)
    githubPRBot = serializers.BooleanField(required=False)
    issueAlertsThreadFlag = serializers.BooleanField(required=False)
    metricAlertsThreadFlag = serializers.BooleanField(required=False)
    metricsActivatePercentiles = serializers.BooleanField(required=False)
    metricsActivateLastForGauges = serializers.BooleanField(required=False)
    require2FA = serializers.BooleanField(required=False)
    trustedRelays = serializers.ListField(child=TrustedRelaySerializer(), required=False)
    allowJoinRequests = serializers.BooleanField(required=False)
    relayPiiConfig = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    apdexThreshold = serializers.IntegerField(min_value=1, required=False)
    uptimeAutodetection = serializers.BooleanField(required=False)
    targetSampleRate = serializers.FloatField(required=False, min_value=0, max_value=1)
    samplingMode = serializers.ChoiceField(choices=DynamicSamplingMode.choices, required=False)
    rollbackEnabled = serializers.BooleanField(required=False)
    rollbackSharingEnabled = serializers.BooleanField(required=False)

    @cached_property
    def _has_legacy_rate_limits(self):
        org = self.context["organization"]
        return OrganizationOption.objects.filter(
            organization=org, key__in=LEGACY_RATE_LIMIT_OPTIONS
        ).exists()

    def _has_sso_enabled(self):
        org = self.context["organization"]
        org_auth_provider = auth_service.get_auth_provider(organization_id=org.id)
        return org_auth_provider is not None

    def validate_relayPiiConfig(self, value):
        organization = self.context["organization"]
        return validate_pii_config_update(organization, value)

    def validate_sensitiveFields(self, value):
        if value and not all(value):
            raise serializers.ValidationError("Empty values are not allowed.")
        if sum(map(len, value)) > MAX_SENSITIVE_FIELD_CHARS:
            raise serializers.ValidationError("List of sensitive fields is too long.")
        return value

    def validate_safeFields(self, value):
        if value and not all(value):
            raise serializers.ValidationError("Empty values are not allowed.")
        return validate_pii_selectors(value)

    def validate_attachmentsRole(self, value):
        try:
            roles.get(value)
        except KeyError:
            raise serializers.ValidationError("Invalid role")
        return value

    def validate_debugFilesRole(self, value):
        try:
            roles.get(value)
        except KeyError:
            raise serializers.ValidationError("Invalid role")
        return value

    def validate_require2FA(self, value):
        user = self.context["user"]
        has_2fa = user.has_2fa()
        if value and not has_2fa:
            raise serializers.ValidationError(ERR_NO_2FA)

        if value and self._has_sso_enabled():
            raise serializers.ValidationError(ERR_SSO_ENABLED)
        return value

    def validate_trustedRelays(self, value):
        from sentry import features

        organization = self.context["organization"]
        request = self.context["request"]
        has_relays = features.has("organizations:relay", organization, actor=request.user)
        if not has_relays:
            raise serializers.ValidationError(
                "Organization does not have the relay feature enabled"
            )

        # make sure we don't have multiple instances of one public key
        public_keys = set()
        if value is not None:
            for key_info in value:
                key = key_info.get("public_key")
                if key in public_keys:
                    raise serializers.ValidationError(f"Duplicated key in Trusted Relays: '{key}'")
                public_keys.add(key)

        return value

    def validate_accountRateLimit(self, value):
        if not self._has_legacy_rate_limits:
            raise serializers.ValidationError(
                "The accountRateLimit option cannot be configured for this organization"
            )
        return value

    def validate_projectRateLimit(self, value):
        if not self._has_legacy_rate_limits:
            raise serializers.ValidationError(
                "The accountRateLimit option cannot be configured for this organization"
            )
        return value

    def validate_targetSampleRate(self, value):
        organization = self.context["organization"]
        request = self.context["request"]
        has_dynamic_sampling_custom = has_custom_dynamic_sampling(organization, actor=request.user)
        if not has_dynamic_sampling_custom:
            raise serializers.ValidationError(
                "Organization does not have the custom dynamic sample rate feature enabled."
            )

        return value

    def validate_samplingMode(self, value):
        organization = self.context["organization"]
        request = self.context["request"]
        has_dynamic_sampling_custom = has_custom_dynamic_sampling(organization, actor=request.user)
        if not has_dynamic_sampling_custom:
            raise serializers.ValidationError(
                "Organization does not have the custom dynamic sample rate feature enabled."
            )

        # as this is handled by a choice field, we don't need to check the values of the field

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("avatarType") == "upload":
            has_existing_file = OrganizationAvatar.objects.filter(
                organization=self.context["organization"], file_id__isnull=False
            ).exists()
            if not has_existing_file and not attrs.get("avatar"):
                raise serializers.ValidationError(
                    {"avatarType": "Cannot set avatarType to upload without avatar"}
                )

        organization = self.context["organization"]
        sampling_mode = organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        request_sampling_mode = attrs.get("samplingMode")
        request_target_sample_rate = attrs.get("targetSampleRate")

        if (
            request_sampling_mode == DynamicSamplingMode.PROJECT.value
            or (
                sampling_mode == DynamicSamplingMode.PROJECT.value
                and request_sampling_mode != DynamicSamplingMode.ORGANIZATION.value
            )
        ) and request_target_sample_rate is not None:
            raise serializers.ValidationError(
                "Must be in Automatic Mode to configure the organization sample rate."
            )

        return attrs

    def save_trusted_relays(self, incoming, changed_data, organization):
        timestamp_now = datetime.now(timezone.utc).isoformat()
        option_key = "sentry:trusted-relays"
        try:
            # get what we already have
            existing = OrganizationOption.objects.get(organization=organization, key=option_key)

            key_dict = {val.get("public_key"): val for val in existing.value}
            original_number_of_keys = len(existing.value)
        except OrganizationOption.DoesNotExist:
            key_dict = {}  # we don't have anything set
            original_number_of_keys = 0
            existing = None

        modified = False
        for option in incoming:
            public_key = option.get("public_key")
            existing_info = key_dict.get(public_key, {})

            option["created"] = existing_info.get("created", timestamp_now)
            option["last_modified"] = existing_info.get("last_modified")

            # check if we modified the current public_key info and update last_modified if we did
            if (
                not existing_info
                or existing_info.get("name") != option.get("name")
                or existing_info.get("description") != option.get("description")
            ):
                option["last_modified"] = timestamp_now
                modified = True

        # check to see if the only modifications were some deletions (which are not captured in the loop above)
        if len(incoming) != original_number_of_keys:
            modified = True

        if modified:
            # we have some modifications create a log message
            if existing is not None:
                # generate an update log message
                changed_data["trustedRelays"] = f"from {existing} to {incoming}"
                existing.value = incoming
                existing.save()
            else:
                # first time we set trusted relays, generate a create log message
                changed_data["trustedRelays"] = f"to {incoming}"
                OrganizationOption.objects.set_value(
                    organization=organization, key=option_key, value=incoming
                )

        return incoming

    def save(self):
        org = self.context["organization"]
        changed_data = {}
        if not hasattr(org, "__data"):
            update_tracked_data(org)

        data = self.validated_data

        for key, option, type_, default_value in ORG_OPTIONS:
            if key not in data:
                continue
            try:
                option_inst = OrganizationOption.objects.get(organization=org, key=option)
                update_tracked_data(option_inst)
            except OrganizationOption.DoesNotExist:
                OrganizationOption.objects.set_value(
                    organization=org, key=option, value=type_(data[key])
                )

                if data[key] != default_value:
                    changed_data[key] = f"to {data[key]}"
            else:
                option_inst.value = data[key]
                # check if ORG_OPTIONS changed
                if has_changed(option_inst, "value"):
                    old_val = old_value(option_inst, "value")
                    changed_data[key] = f"from {old_val} to {option_inst.value}"
                option_inst.save()

        trusted_relay_info = data.get("trustedRelays")
        if trusted_relay_info is not None:
            self.save_trusted_relays(trusted_relay_info, changed_data, org)

        if "openMembership" in data:
            org.flags.allow_joinleave = data["openMembership"]
        if "allowSharedIssues" in data:
            org.flags.disable_shared_issues = not data["allowSharedIssues"]
        if "enhancedPrivacy" in data:
            org.flags.enhanced_privacy = data["enhancedPrivacy"]
        if "isEarlyAdopter" in data:
            org.flags.early_adopter = data["isEarlyAdopter"]
        if "codecovAccess" in data:
            org.flags.codecov_access = data["codecovAccess"]
        if "require2FA" in data:
            org.flags.require_2fa = data["require2FA"]
        if "allowMemberProjectCreation" in data:
            org.flags.disable_member_project_creation = not data["allowMemberProjectCreation"]
        if "allowSuperuserAccess" in data:
            org.flags.prevent_superuser_access = not data["allowSuperuserAccess"]
        if "allowMemberInvite" in data:
            org.flags.disable_member_invite = not data["allowMemberInvite"]
        if "name" in data:
            org.name = data["name"]
        if "slug" in data:
            org.slug = data["slug"]

        org_tracked_field = {
            "name": org.name,
            "slug": org.slug,
            "default_role": org.default_role,
            "flag_field": {
                "allow_joinleave": org.flags.allow_joinleave.is_set,
                "enhanced_privacy": org.flags.enhanced_privacy.is_set,
                "disable_shared_issues": org.flags.disable_shared_issues.is_set,
                "early_adopter": org.flags.early_adopter.is_set,
                "require_2fa": org.flags.require_2fa.is_set,
                "codecov_access": org.flags.codecov_access.is_set,
                "disable_member_project_creation": org.flags.disable_member_project_creation.is_set,
                "prevent_superuser_access": org.flags.prevent_superuser_access.is_set,
                "disable_member_invite": org.flags.disable_member_invite.is_set,
            },
        }

        # check if fields changed
        for f, v in org_tracked_field.items():
            if f != "flag_field":
                if has_changed(org, f):
                    old_val = old_value(org, f)
                    changed_data[f] = f"from {old_val} to {v}"
            else:
                # check if flag fields changed
                for f, v in org_tracked_field["flag_field"].items():
                    if flag_has_changed(org, f):
                        changed_data[f] = f"to {v}"

        org.save()

        if "avatar" in data or "avatarType" in data:
            OrganizationAvatar.save_avatar(
                relation={"organization": org},
                type=data.get("avatarType", "upload"),
                avatar=data.get("avatar"),
                filename=f"{org.slug}.png",
            )
        if data.get("require2FA") is True:
            org.handle_2fa_required(self.context["request"])
        return org, changed_data


class OwnerOrganizationSerializer(OrganizationSerializer):
    defaultRole = serializers.ChoiceField(choices=roles.get_choices())
    cancelDeletion = serializers.BooleanField(required=False)
    idempotencyKey = serializers.CharField(max_length=IDEMPOTENCY_KEY_LENGTH, required=False)

    def save(self, *args, **kwargs):
        org = self.context["organization"]
        update_tracked_data(org)
        data = self.validated_data
        cancel_deletion = "cancelDeletion" in data and org.status in DELETION_STATUSES
        if "defaultRole" in data:
            org.default_role = data["defaultRole"]
        if cancel_deletion:
            org.status = OrganizationStatus.ACTIVE
        return super().save(*args, **kwargs)


from rest_framework.request import Request
from rest_framework.response import Response


def post_org_pending_deletion(
    *, request: Request, org_delete_response: RpcOrganizationDeleteResponse
):
    if org_delete_response.response_state == RpcOrganizationDeleteState.PENDING_DELETION:
        updated_organization = org_delete_response.updated_organization
        assert updated_organization

        entry = create_audit_entry(
            request=request,
            organization=updated_organization,
            target_object=updated_organization.id,
            event=audit_log.get_event_id("ORG_REMOVE"),
            data=updated_organization.get_audit_log_data(),
            transaction_id=org_delete_response.schedule_guid,
        )

        delete_confirmation_args: DeleteConfirmationArgs = dict(
            username=request.user.get_username(),
            ip_address=entry.ip_address,
            deletion_datetime=entry.datetime,
            countdown=ONE_DAY,
            organization=updated_organization,
        )
        send_delete_confirmation(delete_confirmation_args)


@extend_schema_serializer(
    exclude_fields=[
        "accountRateLimit",
        "projectRateLimit",
        "apdexThreshold",
        "genAIConsent",
        "metricsActivatePercentiles",
        "metricsActivateLastForGauges",
    ]
)
class OrganizationDetailsPutSerializer(serializers.Serializer):
    # general
    slug = serializers.CharField(
        max_length=50,
        help_text="The new slug for the organization, which needs to be unique.",
        required=False,
    )
    name = serializers.CharField(
        max_length=64, help_text="The new name for the organization.", required=False
    )
    isEarlyAdopter = serializers.BooleanField(
        help_text="Specify `true` to opt-in to new features before they're released to the public.",
        required=False,
    )
    aiSuggestedSolution = serializers.BooleanField(
        help_text="Specify `true` to opt-in to [AI Suggested Solution](/product/issues/issue-details/ai-suggested-solution/) to get AI help on how to solve an issue.",
        required=False,
    )
    hideAiFeatures = serializers.BooleanField(
        help_text="Specify `true` to hide AI features from the organization.",
        required=False,
    )
    autofixEnabled = serializers.BooleanField(
        help_text="Specify `true` to enable Autofix for the organization.",
        required=False,
    )
    codecovAccess = serializers.BooleanField(
        help_text="Specify `true` to enable Code Coverage Insights. This feature is only available for organizations on the Team plan and above. Learn more about Codecov [here](/product/codecov/).",
        required=False,
    )

    # membership
    defaultRole = serializers.ChoiceField(
        choices=roles.get_choices(),
        help_text="The default role new members will receive.",
        required=False,
    )
    openMembership = serializers.BooleanField(
        help_text="Specify `true` to allow organization members to freely join any team.",
        required=False,
    )
    eventsMemberAdmin = serializers.BooleanField(
        help_text="Specify `true` to allow members to delete events (including the delete & discard action) by granting them the `event:admin` scope.",
        required=False,
    )
    alertsMemberWrite = serializers.BooleanField(
        help_text="Specify `true` to allow members to create, edit, and delete alert rules by granting them the `alerts:write` scope.",
        required=False,
    )
    attachmentsRole = serializers.ChoiceField(
        choices=roles.get_choices(),
        help_text="The role required to download event attachments, such as native crash reports or log files.",
        required=False,
    )
    debugFilesRole = serializers.ChoiceField(
        choices=roles.get_choices(),
        help_text="The role required to download debug information files, ProGuard mappings and source maps.",
        required=False,
    )

    # avatar
    avatarType = serializers.ChoiceField(
        choices=(("letter_avatar", "Use initials"), ("upload", "Upload an image")),
        help_text="The type of display picture for the organization.",
        required=False,
    )
    avatar = serializers.CharField(
        help_text="The image to upload as the organization avatar, in base64. Required if `avatarType` is `upload`.",
        required=False,
    )

    # security & privacy
    require2FA = serializers.BooleanField(
        help_text="Specify `true` to require and enforce two-factor authentication for all members.",
        required=False,
    )
    allowSharedIssues = serializers.BooleanField(
        help_text="Specify `true` to allow sharing of limited details on issues to anonymous users.",
        required=False,
    )
    enhancedPrivacy = serializers.BooleanField(
        help_text="Specify `true` to enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.",
        required=False,
    )
    scrapeJavaScript = serializers.BooleanField(
        help_text="Specify `true` to allow Sentry to scrape missing JavaScript source context when possible.",
        required=False,
    )
    storeCrashReports = serializers.ChoiceField(
        choices=(
            (0, "Disabled"),
            (1, "1 per issue"),
            (5, "5 per issue"),
            (10, "10 per issue"),
            (20, "20 per issue"),
            (50, "50 per issue"),
            (100, "100 per issue"),
            (-1, "Unlimited"),
        ),
        help_text="How many native crash reports (such as Minidumps for improved processing and download in issue details) to store per issue.",
        required=False,
    )
    allowJoinRequests = serializers.BooleanField(
        help_text="Specify `true` to allow users to request to join your organization.",
        required=False,
    )

    # data scrubbing
    dataScrubber = serializers.BooleanField(
        help_text="Specify `true` to require server-side data scrubbing for all projects.",
        required=False,
    )
    dataScrubberDefaults = serializers.BooleanField(
        help_text="Specify `true` to apply the default scrubbers to prevent things like passwords and credit cards from being stored for all projects.",
        required=False,
    )
    sensitiveFields = serializers.ListField(
        child=serializers.CharField(),
        help_text="A list of additional global field names to match against when scrubbing data for all projects.",
        required=False,
    )
    safeFields = serializers.ListField(
        child=serializers.CharField(),
        help_text="A list of global field names which data scrubbers should ignore.",
        required=False,
    )
    scrubIPAddresses = serializers.BooleanField(
        help_text="Specify `true` to prevent IP addresses from being stored for new events on all projects.",
        required=False,
    )
    relayPiiConfig = serializers.CharField(
        help_text="""Advanced data scrubbing rules that can be configured for each project as a JSON string. The new rules will only apply to new incoming events. For more details on advanced data scrubbing, see our [full documentation](/security-legal-pii/scrubbing/advanced-datascrubbing/).

> Warning: Calling this endpoint with this field fully overwrites the advanced data scrubbing rules.

Below is an example of a payload for a set of advanced data scrubbing rules for masking credit card numbers from the log message (equivalent to `[Mask] [Credit card numbers] from [$message]` in the Sentry app) and removing a specific key called `foo` (equivalent to `[Remove] [Anything] from [extra.foo]` in the Sentry app):
```json
{
    relayPiiConfig: "{\\"rules\":{\\"0\\":{\\"type\\":\\"creditcard\\",\\"redaction\\":{\\"method\\":\\"mask\\"}},\\"1\\":{\\"type\\":\\"anything\\",\\"redaction\\":{\\"method\\":\\"remove\\"}}},\\"applications\\":{\\"$message\\":[\\"0\\"],\\"extra.foo\\":[\\"1\\"]}}"
}
```
        """,
        required=False,
    )

    # relay
    trustedRelays = serializers.ListField(
        child=serializers.JSONField(),
        help_text="""A list of local Relays (the name, public key, and description as a JSON) registered for the organization. This feature is only available for organizations on the Business and Enterprise plans. Read more about Relay [here](/product/relay/).

                                          Below is an example of a list containing a single local Relay registered for the organization:
                                          ```json
                                          {
                                            trustedRelays: [
                                                {
                                                    name: "my-relay",
                                                    publicKey: "eiwr9fdruw4erfh892qy4493reyf89ur34wefd90h",
                                                    description: "Configuration for my-relay."
                                                }
                                            ]
                                          }
                                          ```
                                          """,
        required=False,
    )

    # github features
    githubPRBot = serializers.BooleanField(
        help_text="Specify `true` to allow Sentry to comment on recent pull requests suspected of causing issues. Requires a GitHub integration.",
        required=False,
    )
    githubOpenPRBot = serializers.BooleanField(
        help_text="Specify `true` to allow Sentry to comment on open pull requests to show recent error issues for the code being changed. Requires a GitHub integration.",
        required=False,
    )
    githubNudgeInvite = serializers.BooleanField(
        help_text="Specify `true` to allow Sentry to detect users committing to your GitHub repositories that are not part of your Sentry organization. Requires a GitHub integration.",
        required=False,
    )

    # slack features
    issueAlertsThreadFlag = serializers.BooleanField(
        help_text="Specify `true` to allow the Sentry Slack integration to post replies in threads for an Issue Alert notification. Requires a Slack integration.",
        required=False,
    )
    metricAlertsThreadFlag = serializers.BooleanField(
        help_text="Specify `true` to allow the Sentry Slack integration to post replies in threads for a Metric Alert notification. Requires a Slack integration.",
        required=False,
    )

    # restore org
    cancelDeletion = serializers.BooleanField(
        help_text="Specify `true` to restore an organization that is pending deletion.",
        required=False,
    )

    # private attributes
    # legacy features
    accountRateLimit = serializers.IntegerField(
        min_value=ACCOUNT_RATE_LIMIT_DEFAULT, required=False
    )
    projectRateLimit = serializers.IntegerField(
        min_value=PROJECT_RATE_LIMIT_DEFAULT, required=False
    )
    apdexThreshold = serializers.IntegerField(required=False)

    # TODO: publish when GA'd
    metricsActivatePercentiles = serializers.BooleanField(required=False)
    metricsActivateLastForGauges = serializers.BooleanField(required=False)


# NOTE: We override the permission class of this endpoint in getsentry with the OrganizationDetailsPermission class
@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class OrganizationDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, OrganizationParams.DETAILED],
        request=None,
        responses={
            200: org_serializers.OrganizationSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.RETRIEVE_ORGANIZATION,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return details on an individual organization, including various details
        such as membership access and teams.
        """
        # This param will be used to determine if we should include feature flags in the response
        include_feature_flags = request.GET.get("include_feature_flags", "0") != "0"

        serializer = org_serializers.OrganizationSerializer

        if request.access.has_scope("org:read") or is_active_staff(request):
            is_detailed = request.GET.get("detailed", "1") != "0"

            serializer = org_serializers.DetailedOrganizationSerializer
            if is_detailed:
                serializer = org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams

        context = serialize(
            organization,
            request.user,
            serializer(),
            access=request.access,
            include_feature_flags=include_feature_flags,
        )

        return self.respond(context)

    @extend_schema(
        operation_id="Update an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=OrganizationDetailsPutSerializer,
        responses={
            200: DetailedOrganizationSerializerWithProjectsAndTeams,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
            413: OpenApiResponse(description="Image too large."),
        },
        examples=OrganizationExamples.UPDATE_ORGANIZATION,
    )
    def put(self, request: Request, organization: Organization) -> Response:
        """
        Update various attributes and configurable settings for the given organization.
        """
        from sentry import features

        # This param will be used to determine if we should include feature flags in the response
        include_feature_flags = request.GET.get("include_feature_flags", "0") != "0"

        # We don't need to check for staff here b/c the _admin portal uses another endpoint to update orgs
        if request.access.has_scope("org:admin"):
            serializer_cls = OwnerOrganizationSerializer
        else:
            serializer_cls = OrganizationSerializer

        was_pending_deletion = organization.status in DELETION_STATUSES

        enabling_codecov = "codecovAccess" in request.data and request.data["codecovAccess"]
        if enabling_codecov:
            if not features.has("organizations:codecov-integration", organization):
                return self.respond({"detail": ERR_PLAN_REQUIRED}, status=status.HTTP_403_FORBIDDEN)

            has_integration, error = has_codecov_integration(organization)
            if not has_integration:
                return self.respond(
                    {"codecovAccess": [error]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = serializer_cls(
            data=request.data,
            partial=True,
            context={"organization": organization, "user": request.user, "request": request},
        )
        if serializer.is_valid():
            slug_change_requested = "slug" in request.data and request.data["slug"]

            # Attempt slug change first as it's a more complex, control-silo driven workflow.
            if slug_change_requested:
                slug = request.data["slug"]
                try:
                    organization_provisioning_service.change_organization_slug(
                        organization_id=organization.id, slug=slug
                    )
                except OrganizationSlugCollisionException:
                    return self.respond(
                        {"slug": ["An organization with this slug already exists."]},
                        status=status.HTTP_409_CONFLICT,
                    )
            with transaction.atomic(router.db_for_write(Organization)):
                organization, changed_data = serializer.save()

            if request.access.has_scope("org:write") and has_custom_dynamic_sampling(organization):
                is_org_mode = is_organization_mode_sampling(organization)

                # If the sampling mode was changed, adapt the project and org options accordingly
                if "samplingMode" in changed_data:
                    with transaction.atomic(router.db_for_write(ProjectOption)):
                        if is_project_mode_sampling(organization):
                            self._compute_project_target_sample_rates(organization)
                            organization.delete_option("sentry:target_sample_rate")

                        elif is_org_mode:
                            if "targetSampleRate" in changed_data:
                                organization.update_option(
                                    "sentry:target_sample_rate",
                                    serializer.validated_data["targetSampleRate"],
                                )

                            ProjectOption.objects.filter(
                                project__organization_id=organization.id,
                                key="sentry:target_sample_rate",
                            ).delete()

                # If the target sample rate for the org was changed, update the org option
                if is_org_mode and "targetSampleRate" in changed_data:
                    organization.update_option(
                        "sentry:target_sample_rate", serializer.validated_data["targetSampleRate"]
                    )

                # If the sampling mode was changed to org mode or the target sample rate was changed (or both),
                # trigger the rebalancing of project sample rates.
                if is_org_mode and (
                    "samplingMode" in changed_data or "targetSampleRate" in changed_data
                ):
                    boost_low_volume_projects_of_org_with_query.delay(organization.id)

            if was_pending_deletion:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=audit_log.get_event_id("ORG_RESTORE"),
                    data=organization.get_audit_log_data(),
                )
                RegionScheduledDeletion.cancel(organization)
            elif changed_data:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=audit_log.get_event_id("ORG_EDIT"),
                    data=changed_data,
                )

            context = serialize(
                organization,
                request.user,
                org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams(),
                access=request.access,
                include_feature_flags=include_feature_flags,
            )

            return self.respond(context)
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _compute_project_target_sample_rates(self, organization):
        for project in organization.project_set.all():
            current_rate, _ = get_boost_low_volume_projects_sample_rate(
                org_id=organization.id,
                project_id=project.id,
                error_sample_rate_fallback=None,
            )
            if current_rate:
                project.update_option("sentry:target_sample_rate", current_rate)

    def handle_delete(self, request: Request, organization: Organization):
        """
        This method exists as a way for getsentry to override this endpoint with less duplication.
        """
        if not request.user.is_authenticated:
            return self.respond({"detail": ERR_NO_USER}, status=401)

        org_delete_response = organization_service.delete_organization(
            organization_id=organization.id, user=serialize_generic_user(request.user)
        )

        if (
            org_delete_response.response_state
            == RpcOrganizationDeleteState.CANNOT_REMOVE_DEFAULT_ORG
            or organization.is_default
        ):
            return self.respond({"detail": ERR_DEFAULT_ORG}, status=400)

        if (
            org_delete_response.response_state
            == RpcOrganizationDeleteState.OWNS_PUBLISHED_INTEGRATION
        ):
            return self.respond({"detail": ERR_3RD_PARTY_PUBLISHED_APP}, status=400)

        if org_delete_response.response_state == RpcOrganizationDeleteState.PENDING_DELETION:
            organization.status = OrganizationStatus.PENDING_DELETION
            post_org_pending_deletion(
                request=request,
                org_delete_response=org_delete_response,
            )

        context = serialize(
            organization,
            request.user,
            org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams(),
            access=request.access,
        )
        return self.respond(context, status=202)

    @sudo_required
    def delete(self, request: Request, organization) -> Response:
        """
        Delete an Organization
        ``````````````````````
        Schedules an organization for deletion.  This API endpoint cannot
        be invoked without a user context for security reasons.  This means
        that at present an organization can only be deleted from the
        Sentry UI.

        Deletion happens asynchronously and therefore is not immediate.
        However once deletion has begun the state of an organization changes and
        will be hidden from most public views.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          team should be created for.
        :auth: required, user-context-needed
        """
        return self.handle_delete(request, organization)


def flag_has_changed(org, flag_name):
    "Returns ``True`` if ``flag`` has changed since initialization."
    return getattr(old_value(org, "flags"), flag_name, None) != getattr(org.flags, flag_name)


def update_tracked_data(model):
    "Updates a local copy of attributes values"
    if model.id:
        data = {}
        for f in model._meta.fields:
            # XXX(dcramer): this is how Django determines this (copypasta from Model)
            if isinstance(type(f).__dict__.get(f.attname), DeferredAttribute) or f.column is None:
                continue
            try:
                v = get_field_value(model, f)
            except AttributeError as e:
                # this case can come up from pickling
                logging.exception(str(e))
            else:
                if isinstance(v, BitHandler):
                    v = copy(v)
                data[f.column] = v
        model.__data = data
    else:
        model.__data = UNSAVED


class DeleteConfirmationArgs(TypedDict):
    username: str
    ip_address: str
    deletion_datetime: datetime
    organization: RpcOrganization
    countdown: int


def send_delete_confirmation(delete_confirmation_args: DeleteConfirmationArgs):
    from sentry import options
    from sentry.utils.email import MessageBuilder

    organization = delete_confirmation_args.get("organization")
    username = delete_confirmation_args.get("username")
    user_ip_address = delete_confirmation_args.get("ip_address")
    deletion_datetime = delete_confirmation_args.get("deletion_datetime")
    countdown = delete_confirmation_args.get("countdown")

    url = organization.absolute_url(
        reverse("sentry-restore-organization", args=[organization.slug])
    )

    context = {
        "organization": organization,
        "username": username,
        "user_ip_address": user_ip_address,
        "deletion_datetime": deletion_datetime,
        "eta": django_timezone.now() + timedelta(seconds=countdown),
        "url": url,
    }

    message = MessageBuilder(
        subject="{}Organization Queued for Deletion".format(options.get("mail.subject-prefix")),
        template="sentry/emails/org_delete_confirm.txt",
        html_template="sentry/emails/org_delete_confirm.html",
        type="org.confirm_delete",
        context=context,
    )

    owners = organization.get_owners()
    message.send_async([o.email for o in owners])


def get_field_value(model, field):
    if isinstance(type(field).__dict__.get(field.attname), DeferredAttribute):
        return DEFERRED
    if isinstance(field, models.ForeignKey):
        return getattr(model, field.column, None)
    return getattr(model, field.attname, None)


def has_changed(model, field_name):
    "Returns ``True`` if ``field`` has changed since initialization."
    if model.__data is UNSAVED:
        return False
    field = model._meta.get_field(field_name)
    value = get_field_value(model, field)
    if value is DEFERRED:
        return False
    return model.__data.get(field_name) != value


def old_value(model, field_name):
    "Returns the previous value of ``field``"
    if model.__data is UNSAVED:
        return None
    value = model.__data.get(field_name)
    if value is DEFERRED:
        return None
    return model.__data.get(field_name)
