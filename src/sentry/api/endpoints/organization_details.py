from __future__ import annotations

import logging
from copy import copy
from datetime import datetime, timedelta, timezone

from django.db import models, router, transaction
from django.db.models.query_utils import DeferredAttribute
from django.urls import reverse
from django.utils import timezone as django_timezone
from rest_framework import serializers, status
from typing_extensions import TypedDict

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
    TrustedRelaySerializer,
)
from sentry.constants import (
    ACCOUNT_RATE_LIMIT_DEFAULT,
    AI_SUGGESTED_SOLUTION,
    ALERTS_MEMBER_WRITE_DEFAULT,
    ATTACHMENTS_ROLE_DEFAULT,
    DEBUG_FILES_ROLE_DEFAULT,
    EVENTS_MEMBER_ADMIN_DEFAULT,
    GITHUB_COMMENT_BOT_DEFAULT,
    JOIN_REQUESTS_DEFAULT,
    LEGACY_RATE_LIMIT_OPTIONS,
    PROJECT_RATE_LIMIT_DEFAULT,
    REQUIRE_SCRUB_DATA_DEFAULT,
    REQUIRE_SCRUB_DEFAULTS_DEFAULT,
    REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    SAFE_FIELDS_DEFAULT,
    SCRAPE_JAVASCRIPT_DEFAULT,
    SENSITIVE_FIELDS_DEFAULT,
)
from sentry.datascrubbing import validate_pii_config_update, validate_pii_selectors
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.lang.native.utils import (
    STORE_CRASH_REPORTS_DEFAULT,
    STORE_CRASH_REPORTS_MAX,
    convert_crashreport_count,
)
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.models.useremail import UserEmail
from sentry.services.hybrid_cloud import IDEMPOTENCY_KEY_LENGTH
from sentry.services.hybrid_cloud.auth import auth_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.organization.model import (
    RpcOrganization,
    RpcOrganizationDeleteResponse,
    RpcOrganizationDeleteState,
)
from sentry.services.hybrid_cloud.user.serial import serialize_generic_user
from sentry.services.organization.provisioning import (
    OrganizationSlugCollisionException,
    organization_provisioning_service,
)
from sentry.utils.audit import create_audit_entry
from sentry.utils.cache import memoize

ERR_DEFAULT_ORG = "You cannot remove the default organization."
ERR_NO_USER = "This request requires an authenticated user."
ERR_NO_2FA = "Cannot require two-factor authentication without personal two-factor enabled."
ERR_SSO_ENABLED = "Cannot require two-factor authentication with SSO enabled"
ERR_EMAIL_VERIFICATION = "Cannot require email verification before verifying your email address."
ERR_3RD_PARTY_PUBLISHED_APP = "Cannot delete an organization that owns a published integration. Contact support if you need assistance."

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
    codecovAccess = serializers.BooleanField(required=False)
    githubOpenPRBot = serializers.BooleanField(required=False)
    githubNudgeInvite = serializers.BooleanField(required=False)
    githubPRBot = serializers.BooleanField(required=False)
    require2FA = serializers.BooleanField(required=False)
    requireEmailVerification = serializers.BooleanField(required=False)
    trustedRelays = serializers.ListField(child=TrustedRelaySerializer(), required=False)
    allowJoinRequests = serializers.BooleanField(required=False)
    relayPiiConfig = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    apdexThreshold = serializers.IntegerField(min_value=1, required=False)

    @memoize
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

    def validate_requireEmailVerification(self, value):
        user = self.context["user"]
        has_verified = UserEmail.objects.get_primary_email(user).is_verified
        if value and not has_verified:
            raise serializers.ValidationError(ERR_EMAIL_VERIFICATION)
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
        return attrs

    def save_trusted_relays(self, incoming, changed_data, organization):
        timestamp_now = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
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
        from sentry import features

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
        if (
            features.has("organizations:required-email-verification", org)
            and "requireEmailVerification" in data
        ):
            org.flags.require_email_verification = data["requireEmailVerification"]
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
        if (
            features.has("organizations:required-email-verification", org)
            and data.get("requireEmailVerification") is True
        ):
            org.handle_email_verification_required(self.context["request"])
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


@region_silo_endpoint
class OrganizationDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Retrieve an Organization
        ````````````````````````

        Return details on an individual organization including various details
        such as membership access, features, and teams.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string detailed: Specify '0' to retrieve details without projects and teams.
        :auth: required
        """

        serializer = org_serializers.OrganizationSerializer
        if request.access.has_scope("org:read"):
            is_detailed = request.GET.get("detailed", "1") != "0"

            serializer = org_serializers.DetailedOrganizationSerializer
            if is_detailed:
                serializer = org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams

        context = serialize(organization, request.user, serializer(), access=request.access)

        return self.respond(context)

    def put(self, request: Request, organization) -> Response:
        """
        Update an Organization
        ``````````````````````

        Update various attributes and configurable settings for the given
        organization.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string name: an optional new name for the organization.
        :param string slug: an optional new slug for the organization.  Needs
                            to be available and unique.
        :auth: required
        """
        if request.access.has_scope("org:admin"):
            serializer_cls = OwnerOrganizationSerializer
        else:
            serializer_cls = OrganizationSerializer

        was_pending_deletion = organization.status in DELETION_STATUSES

        enabling_codecov = "codecovAccess" in request.data and request.data["codecovAccess"]
        if enabling_codecov:
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
            )

            return self.respond(context)
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

        :pparam string organization_slug: the slug of the organization the
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
