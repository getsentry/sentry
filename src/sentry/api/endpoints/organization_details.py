from __future__ import absolute_import

import logging
import six

from datetime import datetime

from pytz import UTC
from rest_framework import serializers, status
from uuid import uuid4

from sentry import roles
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.fields import AvatarField
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.api.serializers.models import organization as org_serializers
from sentry.api.serializers.models.organization import TrustedRelaySerializer
from sentry.api.serializers.rest_framework import ListField
from sentry.constants import (
    LEGACY_RATE_LIMIT_OPTIONS,
    RESERVED_ORGANIZATION_SLUGS,
)
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
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.cache import memoize

ERR_DEFAULT_ORG = u"You cannot remove the default organization."
ERR_NO_USER = u"This request requires an authenticated user."
ERR_NO_2FA = u"Cannot require two-factor authentication without personal two-factor enabled."
ERR_SSO_ENABLED = u"Cannot require two-factor authentication with SSO enabled"

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
        six.text_type,
        org_serializers.ATTACHMENTS_ROLE_DEFAULT,
    ),
    (
        "eventsMemberAdmin",
        "sentry:events_member_admin",
        bool,
        org_serializers.EVENTS_MEMBER_ADMIN_DEFAULT,
    ),
    (
        "scrubIPAddresses",
        "sentry:require_scrub_ip_address",
        bool,
        org_serializers.REQUIRE_SCRUB_IP_ADDRESS_DEFAULT,
    ),
    ("relayPiiConfig", "sentry:relay_pii_config", six.text_type, None),
    ("allowJoinRequests", "sentry:join_requests", bool, org_serializers.JOIN_REQUESTS_DEFAULT),
    ("apdexThreshold", "sentry:apdex_threshold", int, None),
)

delete_logger = logging.getLogger("sentry.deletions.api")

DELETION_STATUSES = frozenset(
    [OrganizationStatus.PENDING_DELETION, OrganizationStatus.DELETION_IN_PROGRESS]
)


@scenario("RetrieveOrganization")
def retrieve_organization_scenario(runner):
    runner.request(method="GET", path="/organizations/%s/" % runner.org.slug)


@scenario("UpdateOrganization")
def update_organization_scenario(runner):
    with runner.isolated_org("Badly Misnamed") as org:
        runner.request(
            method="PUT",
            path="/organizations/%s/" % org.slug,
            data={"name": "Impeccably Designated", "slug": "impeccably-designated"},
        )


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
    eventsMemberAdmin = serializers.BooleanField(required=False)
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
                'This slug "%s" is too short. Minimum of 3 characters.' % (value,)
            )
        if value in RESERVED_ORGANIZATION_SLUGS:
            raise serializers.ValidationError(
                'This slug "%s" is reserved and not allowed.' % (value,)
            )
        qs = Organization.objects.filter(slug=value).exclude(id=self.context["organization"].id)
        if qs.exists():
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
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
                    raise serializers.ValidationError(
                        "Duplicated key in Trusted Relays: '{}'".format(key)
                    )
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
        attrs = super(OrganizationSerializer, self).validate(attrs)
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
                changed_data["trustedRelays"] = u"from {} to {}".format(existing, incoming)
                existing.value = incoming
                existing.save()
            else:
                # first time we set trusted relays, generate a create log message
                changed_data["trustedRelays"] = u"to {}".format(incoming)
                OrganizationOption.objects.set_value(
                    organization=organization, key=option_key, value=incoming
                )

        return incoming

    def save(self):
        org = self.context["organization"]
        changed_data = {}

        for key, option, type_, default_value in ORG_OPTIONS:
            if key not in self.initial_data:
                continue
            try:
                option_inst = OrganizationOption.objects.get(organization=org, key=option)
            except OrganizationOption.DoesNotExist:
                OrganizationOption.objects.set_value(
                    organization=org, key=option, value=type_(self.initial_data[key])
                )

                if self.initial_data[key] != default_value:
                    changed_data[key] = u"to {}".format(self.initial_data[key])
            else:
                option_inst.value = self.initial_data[key]
                # check if ORG_OPTIONS changed
                if option_inst.has_changed("value"):
                    old_val = option_inst.old_value("value")
                    changed_data[key] = u"from {} to {}".format(old_val, option_inst.value)
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
        for f, v in six.iteritems(org_tracked_field):
            if f != "flag_field":
                if org.has_changed(f):
                    old_val = org.old_value(f)
                    changed_data[f] = u"from {} to {}".format(old_val, v)
            else:
                # check if flag fields changed
                for f, v in six.iteritems(org_tracked_field["flag_field"]):
                    if org.flag_has_changed(f):
                        changed_data[f] = u"to {}".format(v)

        org.save()

        if "avatar" in self.initial_data or "avatarType" in self.initial_data:
            OrganizationAvatar.save_avatar(
                relation={"organization": org},
                type=self.initial_data.get("avatarType", "upload"),
                avatar=self.initial_data.get("avatar"),
                filename=u"{}.png".format(org.slug),
            )
        if "require2FA" in self.initial_data and self.initial_data["require2FA"] is True:
            org.handle_2fa_required(self.context["request"])
        return org, changed_data


class OwnerOrganizationSerializer(OrganizationSerializer):
    defaultRole = serializers.ChoiceField(choices=roles.get_choices())
    cancelDeletion = serializers.BooleanField(required=False)

    def save(self, *args, **kwargs):
        org = self.context["organization"]
        cancel_deletion = "cancelDeletion" in self.initial_data and org.status in DELETION_STATUSES
        if "defaultRole" in self.initial_data:
            org.default_role = self.initial_data["defaultRole"]
        if cancel_deletion:
            org.status = OrganizationStatus.VISIBLE
        return super(OwnerOrganizationSerializer, self).save(*args, **kwargs)


class OrganizationDetailsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([retrieve_organization_scenario])
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

    @attach_scenarios([update_organization_scenario])
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
        if not request.user.is_authenticated():
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
