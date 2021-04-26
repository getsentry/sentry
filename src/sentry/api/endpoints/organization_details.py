import logging
from copy import copy
from datetime import datetime
from uuid import uuid4

from django.db import models
from django.db.models.query_utils import DeferredAttribute
from pytz import UTC
from rest_framework import serializers, status

from bitfield.types import BitHandler
from sentry import roles
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.fields import AvatarField
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.api.serializers.models import organization as org_serializers
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.api.serializers.rest_framework import ListField
from sentry.constants import LEGACY_RATE_LIMIT_OPTIONS, RESERVED_ORGANIZATION_SLUGS
from sentry.datascrubbing import validate_pii_config_update
from sentry.lang.native.utils import STORE_CRASH_REPORTS_DEFAULT, convert_crashreport_count
from sentry.models import (
    AuditLogEntryEvent,
    Authenticator,
    AuthProvider,
    Organization,
    OrganizationAvatar,
    OrganizationOption,
    OrganizationStatus,
)
from sentry.tasks.deletion import delete_organization
from sentry.utils.cache import memoize

ERR_DEFAULT_ORG = "You cannot remove the default organization."
ERR_NO_USER = "This request requires an authenticated user."
ERR_NO_2FA = "Cannot require two-factor authentication without personal two-factor enabled."
ERR_SSO_ENABLED = "Cannot require two-factor authentication with SSO enabled"

ORG_OPTIONS = (
    # serializer field name, option key name, type, default value
    (
        "projectRateLimit",
        "sentry:project-rate-limit",
        int,
        org_serializers.PROJECT_RATE_LIMIT_DEFAULT,
    ),
    (
        "accountRateLimit",
        "sentry:account-rate-limit",
        int,
        org_serializers.ACCOUNT_RATE_LIMIT_DEFAULT,
    ),
    ("dataScrubber", "sentry:require_scrub_data", bool, org_serializers.REQUIRE_SCRUB_DATA_DEFAULT),
    ("sensitiveFields", "sentry:sensitive_fields", list, org_serializers.SENSITIVE_FIELDS_DEFAULT),
    ("safeFields", "sentry:safe_fields", list, org_serializers.SAFE_FIELDS_DEFAULT),
    (
        "scrapeJavaScript",
        "sentry:scrape_javascript",
        bool,
        org_serializers.SCRAPE_JAVASCRIPT_DEFAULT,
    ),
    (
        "dataScrubberDefaults",
        "sentry:require_scrub_defaults",
        bool,
        org_serializers.REQUIRE_SCRUB_DEFAULTS_DEFAULT,
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
        org_serializers.ATTACHMENTS_ROLE_DEFAULT,
    ),
    (
        "debugFilesRole",
        "sentry:debug_files_role",
        str,
        org_serializers.DEBUG_FILES_ROLE_DEFAULT,
    ),
    (
        "eventsMemberAdmin",
        "sentry:events_member_admin",
        bool,
        org_serializers.EVENTS_MEMBER_ADMIN_DEFAULT,
    ),
    (
        "alertsMemberWrite",
        "sentry:alerts_member_write",
        bool,
        org_serializers.ALERTS_MEMBER_WRITE_DEFAULT,
    ),
    (
        "scrubIPAddresses",
        "sentry:require_scrub_ip_address",
        bool,
        org_serializers.REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    ),
    ("relayPiiConfig", "sentry:relay_pii_config", str, None),
    ("allowJoinRequests", "sentry:join_requests", bool, org_serializers.JOIN_REQUESTS_DEFAULT),
    ("apdexThreshold", "sentry:apdex_threshold", int, None),
)

delete_logger = logging.getLogger("sentry.deletions.api")

DELETION_STATUSES = frozenset(
    [OrganizationStatus.PENDING_DELETION, OrganizationStatus.DELETION_IN_PROGRESS]
)

UNSAVED = object()
DEFERRED = object()


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50)
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
    sensitiveFields = ListField(child=serializers.CharField(), required=False)
    safeFields = ListField(child=serializers.CharField(), required=False)
    storeCrashReports = serializers.IntegerField(min_value=-1, max_value=20, required=False)
    attachmentsRole = serializers.CharField(required=True)
    debugFilesRole = serializers.CharField(required=True)
    eventsMemberAdmin = serializers.BooleanField(required=False)
    alertsMemberWrite = serializers.BooleanField(required=False)
    scrubIPAddresses = serializers.BooleanField(required=False)
    scrapeJavaScript = serializers.BooleanField(required=False)
    isEarlyAdopter = serializers.BooleanField(required=False)
    require2FA = serializers.BooleanField(required=False)
    trustedRelays = ListField(child=TrustedRelaySerializer(), required=False)
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
        return AuthProvider.objects.filter(organization=org).exists()

    def validate_slug(self, value):
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
        qs = Organization.objects.filter(slug=value).exclude(id=self.context["organization"].id)
        if qs.exists():
            raise serializers.ValidationError(f'The slug "{value}" is already in use.')
        return value

    def validate_relayPiiConfig(self, value):
        organization = self.context["organization"]
        return validate_pii_config_update(organization, value)

    def validate_sensitiveFields(self, value):
        if value and not all(value):
            raise serializers.ValidationError("Empty values are not allowed.")
        return value

    def validate_safeFields(self, value):
        if value and not all(value):
            raise serializers.ValidationError("Empty values are not allowed.")
        return value

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
        has_2fa = Authenticator.objects.user_has_2fa(user)
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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("avatarType") == "upload":
            has_existing_file = OrganizationAvatar.objects.filter(
                organization=self.context["organization"], file__isnull=False
            ).exists()
            if not has_existing_file and not attrs.get("avatar"):
                raise serializers.ValidationError(
                    {"avatarType": "Cannot set avatarType to upload without avatar"}
                )
        return attrs

    def save_trusted_relays(self, incoming, changed_data, organization):
        timestamp_now = datetime.utcnow().replace(tzinfo=UTC).isoformat()
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

        for key, option, type_, default_value in ORG_OPTIONS:
            if key not in self.initial_data:
                continue
            try:
                option_inst = OrganizationOption.objects.get(organization=org, key=option)
                update_tracked_data(option_inst)
            except OrganizationOption.DoesNotExist:
                OrganizationOption.objects.set_value(
                    organization=org, key=option, value=type_(self.initial_data[key])
                )

                if self.initial_data[key] != default_value:
                    changed_data[key] = f"to {self.initial_data[key]}"
            else:
                option_inst.value = self.initial_data[key]
                # check if ORG_OPTIONS changed
                if has_changed(option_inst, "value"):
                    old_val = old_value(option_inst, "value")
                    changed_data[key] = f"from {old_val} to {option_inst.value}"
                option_inst.save()

        trusted_realy_info = self.validated_data.get("trustedRelays")
        if trusted_realy_info is not None:
            self.save_trusted_relays(trusted_realy_info, changed_data, org)

        if "openMembership" in self.initial_data:
            org.flags.allow_joinleave = self.initial_data["openMembership"]
        if "allowSharedIssues" in self.initial_data:
            org.flags.disable_shared_issues = not self.initial_data["allowSharedIssues"]
        if "enhancedPrivacy" in self.initial_data:
            org.flags.enhanced_privacy = self.initial_data["enhancedPrivacy"]
        if "isEarlyAdopter" in self.initial_data:
            org.flags.early_adopter = self.initial_data["isEarlyAdopter"]
        if "require2FA" in self.initial_data:
            org.flags.require_2fa = self.initial_data["require2FA"]
        if "name" in self.initial_data:
            org.name = self.initial_data["name"]
        if "slug" in self.initial_data:
            org.slug = self.initial_data["slug"]

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

        if "avatar" in self.initial_data or "avatarType" in self.initial_data:
            OrganizationAvatar.save_avatar(
                relation={"organization": org},
                type=self.initial_data.get("avatarType", "upload"),
                avatar=self.initial_data.get("avatar"),
                filename=f"{org.slug}.png",
            )
        if "require2FA" in self.initial_data and self.initial_data["require2FA"] is True:
            org.handle_2fa_required(self.context["request"])
        return org, changed_data


class OwnerOrganizationSerializer(OrganizationSerializer):
    defaultRole = serializers.ChoiceField(choices=roles.get_choices())
    cancelDeletion = serializers.BooleanField(required=False)

    def save(self, *args, **kwargs):
        org = self.context["organization"]
        update_tracked_data(org)
        cancel_deletion = "cancelDeletion" in self.initial_data and org.status in DELETION_STATUSES
        if "defaultRole" in self.initial_data:
            org.default_role = self.initial_data["defaultRole"]
        if cancel_deletion:
            org.status = OrganizationStatus.VISIBLE
        return super().save(*args, **kwargs)


class OrganizationDetailsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
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
        is_detailed = request.GET.get("detailed", "1") != "0"
        serializer = (
            org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams
            if is_detailed
            else org_serializers.DetailedOrganizationSerializer
        )
        context = serialize(organization, request.user, serializer(), access=request.access)

        return self.respond(context)

    def put(self, request, organization):
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

        serializer = serializer_cls(
            data=request.data,
            partial=True,
            context={"organization": organization, "user": request.user, "request": request},
        )
        if serializer.is_valid():
            organization, changed_data = serializer.save()

            if was_pending_deletion:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=AuditLogEntryEvent.ORG_RESTORE,
                    data=organization.get_audit_log_data(),
                )
                delete_logger.info(
                    "object.delete.canceled",
                    extra={"object_id": organization.id, "model": Organization.__name__},
                )
            elif changed_data:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=organization.id,
                    event=AuditLogEntryEvent.ORG_EDIT,
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

    def handle_delete(self, request, organization):
        """
        This method exists as a way for getsentry to override this endpoint with less duplication.
        """
        if not request.user.is_authenticated:
            return self.respond({"detail": ERR_NO_USER}, status=401)
        if organization.is_default:
            return self.respond({"detail": ERR_DEFAULT_ORG}, status=400)
        updated = Organization.objects.filter(
            id=organization.id, status=OrganizationStatus.VISIBLE
        ).update(status=OrganizationStatus.PENDING_DELETION)
        if updated:
            transaction_id = uuid4().hex
            countdown = 86400
            entry = self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_REMOVE,
                data=organization.get_audit_log_data(),
                transaction_id=transaction_id,
            )
            organization.send_delete_confirmation(entry, countdown)
            delete_organization.apply_async(
                kwargs={
                    "object_id": organization.id,
                    "transaction_id": transaction_id,
                    "actor_id": request.user.id,
                },
                countdown=countdown,
            )
            delete_logger.info(
                "object.delete.queued",
                extra={
                    "object_id": organization.id,
                    "transaction_id": transaction_id,
                    "model": Organization.__name__,
                },
            )
        context = serialize(
            organization,
            request.user,
            org_serializers.DetailedOrganizationSerializerWithProjectsAndTeams(),
            access=request.access,
        )
        return self.respond(context, status=202)

    @sudo_required
    def delete(self, request, organization):
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
