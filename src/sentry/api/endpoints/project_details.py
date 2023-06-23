import math
import time
from datetime import timedelta
from itertools import chain
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry import options as sentry_options
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.decorators import sudo_required
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import DetailedProjectSerializer
from sentry.api.serializers.rest_framework.list import EmptyListField, ListField
from sentry.api.serializers.rest_framework.origin import OriginField
from sentry.auth.superuser import is_active_superuser
from sentry.constants import RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.datascrubbing import validate_pii_config_update
from sentry.dynamic_sampling import generate_rules, get_supported_biases_ids, get_user_biases
from sentry.grouping.enhancer import Enhancements, InvalidEnhancerConfig
from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig
from sentry.ingest.inbound_filters import FilterTypes
from sentry.lang.native.sources import (
    InvalidSourcesError,
    parse_backfill_sources,
    parse_sources,
    redact_source_secrets,
)
from sentry.lang.native.utils import STORE_CRASH_REPORTS_MAX, convert_crashreport_count
from sentry.models import (
    Group,
    GroupStatus,
    NotificationSetting,
    Project,
    ProjectBookmark,
    ProjectRedirect,
    ScheduledDeletion,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.notifications.utils import has_alert_integration
from sentry.notifications.utils.legacy_mappings import get_option_value_from_boolean
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

#: Maximum total number of characters in sensitiveFields.
#: Relay compiles this list into a regex which cannot exceed a certain size.
#: Limit determined experimentally here: https://github.com/getsentry/relay/blob/3105d8544daca3a102c74cefcd77db980306de71/relay-general/src/pii/convert.rs#L289
MAX_SENSITIVE_FIELD_CHARS = 4000


def clean_newline_inputs(value, case_insensitive=True):
    result = []
    for v in value.split("\n"):
        if case_insensitive:
            v = v.lower()
        v = v.strip()
        if v:
            result.append(v)
    return result


class DynamicSamplingBiasSerializer(serializers.Serializer):
    id = serializers.ChoiceField(required=True, choices=get_supported_biases_ids())
    active = serializers.BooleanField(default=False)

    def validate(self, data):
        if data.keys() != {"id", "active"}:
            raise serializers.ValidationError(
                "Error: Only 'id' and 'active' fields are allowed for bias."
            )
        return data


class ProjectMemberSerializer(serializers.Serializer):
    isBookmarked = serializers.BooleanField()
    isSubscribed = serializers.BooleanField()


class ProjectAdminSerializer(ProjectMemberSerializer):
    name = serializers.CharField(max_length=200)
    slug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50)
    team = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50)
    digestsMinDelay = serializers.IntegerField(min_value=60, max_value=3600)
    digestsMaxDelay = serializers.IntegerField(min_value=60, max_value=3600)
    subjectPrefix = serializers.CharField(max_length=200, allow_blank=True)
    subjectTemplate = serializers.CharField(max_length=200)
    securityToken = serializers.RegexField(
        r"^[-a-zA-Z0-9+/=\s]+$", max_length=255, allow_blank=True
    )
    securityTokenHeader = serializers.RegexField(
        r"^[a-zA-Z0-9_\-]+$", max_length=20, allow_blank=True
    )
    verifySSL = serializers.BooleanField(required=False)

    defaultEnvironment = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    dataScrubber = serializers.BooleanField(required=False)
    dataScrubberDefaults = serializers.BooleanField(required=False)
    sensitiveFields = ListField(child=serializers.CharField(), required=False)
    safeFields = ListField(child=serializers.CharField(), required=False)
    storeCrashReports = serializers.IntegerField(
        min_value=-1, max_value=STORE_CRASH_REPORTS_MAX, required=False, allow_null=True
    )
    relayPiiConfig = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    builtinSymbolSources = ListField(child=serializers.CharField(), required=False)
    symbolSources = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scrubIPAddresses = serializers.BooleanField(required=False)
    groupingConfig = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    groupingEnhancements = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    fingerprintingRules = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    secondaryGroupingConfig = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    secondaryGroupingExpiry = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    groupingAutoUpdate = serializers.BooleanField(required=False)
    scrapeJavaScript = serializers.BooleanField(required=False)
    allowedDomains = EmptyListField(child=OriginField(allow_blank=True), required=False)
    resolveAge = EmptyIntegerField(required=False, allow_null=True)
    platform = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    copy_from_project = serializers.IntegerField(required=False)
    dynamicSamplingBiases = DynamicSamplingBiasSerializer(required=False, many=True)
    performanceIssueCreationRate = serializers.FloatField(required=False, min_value=0, max_value=1)
    performanceIssueCreationThroughPlatform = serializers.BooleanField(required=False)
    performanceIssueSendToPlatform = serializers.BooleanField(required=False)

    def validate(self, data):
        max_delay = (
            data["digestsMaxDelay"]
            if "digestsMaxDelay" in data
            else self.context["project"].get_option("digests:mail:maximum_delay")
        )
        min_delay = (
            data["digestsMinDelay"]
            if "digestsMinDelay" in data
            else self.context["project"].get_option("digests:mail:minimum_delay")
        )

        if min_delay is not None and max_delay and max_delay is not None and min_delay > max_delay:
            raise serializers.ValidationError(
                {"digestsMinDelay": "The minimum delay on digests must be lower than the maximum."}
            )

        return data

    def validate_allowedDomains(self, value):
        value = list(filter(bool, value))
        if len(value) == 0:
            raise serializers.ValidationError(
                "Empty value will block all requests, use * to accept from all domains"
            )
        return value

    def validate_slug(self, slug):
        if slug in RESERVED_PROJECT_SLUGS:
            raise serializers.ValidationError(f'The slug "{slug}" is reserved and not allowed.')
        project = self.context["project"]
        other = (
            Project.objects.filter(slug=slug, organization=project.organization)
            .exclude(id=project.id)
            .first()
        )
        if other is not None:
            raise serializers.ValidationError(
                "Another project (%s) is already using that slug" % other.name
            )
        return slug

    def validate_relayPiiConfig(self, value):
        organization = self.context["project"].organization
        return validate_pii_config_update(organization, value)

    def validate_builtinSymbolSources(self, value):
        if not value:
            return value

        from sentry import features

        organization = self.context["project"].organization
        request = self.context["request"]
        has_sources = features.has("organizations:symbol-sources", organization, actor=request.user)

        if not has_sources:
            raise serializers.ValidationError("Organization is not allowed to set symbol sources")

        return value

    def validate_symbolSources(self, sources_json):
        if not sources_json:
            return sources_json

        from sentry import features

        organization = self.context["project"].organization
        request = self.context["request"]

        try:
            # We should really only grab and parse if there are sources in sources_json whose
            # secrets are set to {"hidden-secret":true}
            orig_sources = parse_sources(
                self.context["project"].get_option("sentry:symbol_sources")
            )
            sources = parse_backfill_sources(sources_json.strip(), orig_sources)
        except InvalidSourcesError as e:
            raise serializers.ValidationError(str(e))

        # If no sources are added or modified, we're either only deleting sources or doing nothing.
        # This is always allowed.
        added_or_modified_sources = [s for s in sources if s not in orig_sources]
        if not added_or_modified_sources:
            return json.dumps(sources) if sources else ""

        # All modified sources should get a new UUID, as a way to invalidate caches.
        # Downstream symbolicator uses this ID as part of a cache key, so assigning
        # a new ID does have the following effects/tradeoffs:
        # * negative cache entries (eg auth errors) are retried immediately.
        # * positive caches are re-fetches as well, making it less effective.
        for source in added_or_modified_sources:
            # This should only apply to sources which are being fed to symbolicator.
            # App Store Connect in particular is managed in a completely different
            # way, and needs its `id` to stay valid for a longer time.
            if source["type"] != "appStoreConnect":
                source["id"] = str(uuid4())

        sources_json = json.dumps(sources) if sources else ""

        # Adding sources is only allowed if custom symbol sources are enabled.
        has_sources = features.has(
            "organizations:custom-symbol-sources", organization, actor=request.user
        )

        if not has_sources:
            raise serializers.ValidationError(
                "Organization is not allowed to set custom symbol sources"
            )

        has_multiple_appconnect = features.has(
            "organizations:app-store-connect-multiple", organization, actor=request.user
        )
        appconnect_sources = [s for s in sources if s.get("type") == "appStoreConnect"]
        if not has_multiple_appconnect and len(appconnect_sources) > 1:
            raise serializers.ValidationError(
                "Only one Apple App Store Connect application is allowed in this project"
            )

        return sources_json

    def validate_groupingEnhancements(self, value):
        if not value:
            return value

        try:
            Enhancements.from_config_string(value)
        except InvalidEnhancerConfig as e:
            raise serializers.ValidationError(str(e))

        return value

    def validate_secondaryGroupingExpiry(self, value):
        if not isinstance(value, (int, float)) or math.isnan(value):
            raise serializers.ValidationError(
                f"Grouping expiry must be a numerical value, a UNIX timestamp with second resolution, found {type(value)}"
            )
        now = time.time()
        if value < now:
            raise serializers.ValidationError(
                "Grouping expiry must be sometime within the next 90 days and not in the past. Perhaps you specified the timestamp not in seconds?"
            )

        max_expiry_date = now + (91 * 24 * 3600)
        if value > max_expiry_date:
            value = max_expiry_date

        return value

    def validate_fingerprintingRules(self, value):
        if not value:
            return value

        try:
            FingerprintingRules.from_config_string(value)
        except InvalidFingerprintingConfig as e:
            raise serializers.ValidationError(str(e))

        return value

    def validate_copy_from_project(self, other_project_id):
        try:
            other_project = Project.objects.filter(
                id=other_project_id, organization_id=self.context["project"].organization_id
            ).prefetch_related("teams")[0]
        except IndexError:
            raise serializers.ValidationError("Project to copy settings from not found.")

        request = self.context["request"]
        if not request.access.has_project_access(other_project):
            raise serializers.ValidationError(
                "Project settings cannot be copied from a project you do not have access to."
            )

        for project_team in other_project.projectteam_set.all():
            if not request.access.has_team_scope(project_team.team, "team:write"):
                raise serializers.ValidationError(
                    "Project settings cannot be copied from a project with a team you do not have write access to."
                )

        return other_project_id

    def validate_platform(self, value):
        if Project.is_valid_platform(value):
            return value
        raise serializers.ValidationError("Invalid platform")

    def validate_sensitiveFields(self, value):
        if sum(map(len, value)) > MAX_SENSITIVE_FIELD_CHARS:
            raise serializers.ValidationError("List of sensitive fields is too long.")
        return value


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        # PUT checks for permissions based on fields
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


@region_silo_endpoint
class ProjectDetailsEndpoint(ProjectEndpoint):
    permission_classes = [RelaxedProjectPermission]

    def _get_unresolved_count(self, project):
        queryset = Group.objects.filter(status=GroupStatus.UNRESOLVED, project=project)

        resolve_age = project.get_option("sentry:resolve_age", None)
        if resolve_age:
            queryset = queryset.filter(
                last_seen__gte=timezone.now() - timedelta(hours=int(resolve_age))
            )

        return queryset.count()

    def get(self, request: Request, project) -> Response:
        """
        Retrieve a Project
        ``````````````````

        Return details on an individual project.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to retrieve.
        :auth: required
        """
        data = serialize(project, request.user, DetailedProjectSerializer())

        # TODO: should switch to expand and move logic into the serializer
        include = set(filter(bool, request.GET.get("include", "").split(",")))
        if "stats" in include:
            data["stats"] = {"unresolved": self._get_unresolved_count(project)}

        expand = request.GET.getlist("expand", [])
        if "hasAlertIntegration" in expand:
            data["hasAlertIntegrationInstalled"] = has_alert_integration(project)

        # Dynamic Sampling Logic
        if features.has(
            "organizations:dynamic-sampling", project.organization
        ) and sentry_options.get("dynamic-sampling:enabled-biases"):
            ds_bias_serializer = DynamicSamplingBiasSerializer(
                data=get_user_biases(project.get_option("sentry:dynamic_sampling_biases", None)),
                many=True,
            )
            if not ds_bias_serializer.is_valid():
                return Response(ds_bias_serializer.errors, status=400)
            data["dynamicSamplingBiases"] = ds_bias_serializer.data

            include_rules = request.GET.get("includeDynamicSamplingRules") == "1"
            if include_rules and is_active_superuser(request):
                data["dynamicSamplingRules"] = {
                    "rules": [],
                    "rulesV2": generate_rules(project),
                }
        else:
            data["dynamicSamplingBiases"] = None
            data["dynamicSamplingRules"] = None

        return Response(data)

    def put(self, request: Request, project) -> Response:
        """
        Update a Project
        ````````````````

        Update various attributes and configurable settings for the given
        project.  Only supplied values are updated.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to update.
        :param string name: the new name for the project.
        :param string slug: the new slug for the project.
        :param string platform: the new platform for the project.
        :param boolean isBookmarked: in case this API call is invoked with a
                                     user context this allows changing of
                                     the bookmark flag.
        :param int digestsMinDelay:
        :param int digestsMaxDelay:
        :auth: required
        """

        old_data = serialize(project, request.user, DetailedProjectSerializer())
        has_project_write = request.access and (
            request.access.has_scope("project:write")
            or request.access.has_project_scope(project, "project:write")
        )

        if has_project_write:
            serializer_cls = ProjectAdminSerializer
        else:
            serializer_cls = ProjectMemberSerializer

        serializer = serializer_cls(
            data=request.data, partial=True, context={"project": project, "request": request}
        )
        serializer.is_valid()

        result = serializer.validated_data

        if result.get("dynamicSamplingBiases") and not (
            features.has("organizations:dynamic-sampling", project.organization)
            and sentry_options.get("dynamic-sampling:enabled-biases")
        ):
            return Response(
                {"detail": ["dynamicSamplingBiases is not a valid field"]},
                status=403,
            )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if not has_project_write:
            # options isn't part of the serializer, but should not be editable by members
            for key in chain(ProjectAdminSerializer().fields.keys(), ["options"]):
                if request.data.get(key) and not result.get(key):
                    return Response(
                        {"detail": ["You do not have permission to perform this action."]},
                        status=403,
                    )

        changed = False
        changed_proj_settings = {}

        old_slug = None
        if result.get("slug"):
            old_slug = project.slug
            project.slug = result["slug"]
            changed = True
            changed_proj_settings["new_slug"] = project.slug
            changed_proj_settings["old_slug"] = old_slug

        if result.get("name"):
            project.name = result["name"]
            changed = True
            changed_proj_settings["new_project"] = project.name

        if result.get("platform"):
            project.platform = result["platform"]
            changed = True

        if changed:
            project.save()
            if old_slug:
                ProjectRedirect.record(project, old_slug)

        if result.get("isBookmarked"):
            try:
                with transaction.atomic():
                    ProjectBookmark.objects.create(project_id=project.id, user_id=request.user.id)
            except IntegrityError:
                pass
        elif result.get("isBookmarked") is False:
            ProjectBookmark.objects.filter(project_id=project.id, user_id=request.user.id).delete()

        if result.get("digestsMinDelay"):
            project.update_option("digests:mail:minimum_delay", result["digestsMinDelay"])
        if result.get("digestsMaxDelay"):
            project.update_option("digests:mail:maximum_delay", result["digestsMaxDelay"])
        if result.get("subjectPrefix") is not None:
            if project.update_option("mail:subject_prefix", result["subjectPrefix"]):
                changed_proj_settings["mail:subject_prefix"] = result["subjectPrefix"]
        if result.get("subjectTemplate"):
            project.update_option("mail:subject_template", result["subjectTemplate"])
        if result.get("scrubIPAddresses") is not None:
            if project.update_option("sentry:scrub_ip_address", result["scrubIPAddresses"]):
                changed_proj_settings["sentry:scrub_ip_address"] = result["scrubIPAddresses"]
        if result.get("groupingConfig") is not None:
            if project.update_option("sentry:grouping_config", result["groupingConfig"]):
                changed_proj_settings["sentry:grouping_config"] = result["groupingConfig"]
        if result.get("groupingEnhancements") is not None:
            if project.update_option(
                "sentry:grouping_enhancements", result["groupingEnhancements"]
            ):
                changed_proj_settings["sentry:grouping_enhancements"] = result[
                    "groupingEnhancements"
                ]
        if result.get("fingerprintingRules") is not None:
            if project.update_option("sentry:fingerprinting_rules", result["fingerprintingRules"]):
                changed_proj_settings["sentry:fingerprinting_rules"] = result["fingerprintingRules"]
        if result.get("secondaryGroupingConfig") is not None:
            if project.update_option(
                "sentry:secondary_grouping_config", result["secondaryGroupingConfig"]
            ):
                changed_proj_settings["sentry:secondary_grouping_config"] = result[
                    "secondaryGroupingConfig"
                ]
        if result.get("secondaryGroupingExpiry") is not None:
            if project.update_option(
                "sentry:secondary_grouping_expiry", result["secondaryGroupingExpiry"]
            ):
                changed_proj_settings["sentry:secondary_grouping_expiry"] = result[
                    "secondaryGroupingExpiry"
                ]
        if result.get("groupingAutoUpdate") is not None:
            if project.update_option("sentry:grouping_auto_update", result["groupingAutoUpdate"]):
                changed_proj_settings["sentry:grouping_auto_update"] = result["groupingAutoUpdate"]
        if result.get("securityToken") is not None:
            if project.update_option("sentry:token", result["securityToken"]):
                changed_proj_settings["sentry:token"] = result["securityToken"]
        if result.get("securityTokenHeader") is not None:
            if project.update_option("sentry:token_header", result["securityTokenHeader"]):
                changed_proj_settings["sentry:token_header"] = result["securityTokenHeader"]
        if result.get("verifySSL") is not None:
            if project.update_option("sentry:verify_ssl", result["verifySSL"]):
                changed_proj_settings["sentry:verify_ssl"] = result["verifySSL"]
        if result.get("dataScrubber") is not None:
            if project.update_option("sentry:scrub_data", result["dataScrubber"]):
                changed_proj_settings["sentry:scrub_data"] = result["dataScrubber"]
        if result.get("dataScrubberDefaults") is not None:
            if project.update_option("sentry:scrub_defaults", result["dataScrubberDefaults"]):
                changed_proj_settings["sentry:scrub_defaults"] = result["dataScrubberDefaults"]
        if result.get("sensitiveFields") is not None:
            if project.update_option("sentry:sensitive_fields", result["sensitiveFields"]):
                changed_proj_settings["sentry:sensitive_fields"] = result["sensitiveFields"]
        if result.get("safeFields") is not None:
            if project.update_option("sentry:safe_fields", result["safeFields"]):
                changed_proj_settings["sentry:safe_fields"] = result["safeFields"]
        if result.get("storeCrashReports") is not None:
            if project.get_option("sentry:store_crash_reports") != result["storeCrashReports"]:
                changed_proj_settings["sentry:store_crash_reports"] = result["storeCrashReports"]
                if result["storeCrashReports"] is None:
                    project.delete_option("sentry:store_crash_reports")
                else:
                    project.update_option("sentry:store_crash_reports", result["storeCrashReports"])
        if result.get("relayPiiConfig") is not None:
            if project.update_option("sentry:relay_pii_config", result["relayPiiConfig"]):
                changed_proj_settings["sentry:relay_pii_config"] = (
                    result["relayPiiConfig"].strip() or None
                )
        if result.get("builtinSymbolSources") is not None:
            if project.update_option(
                "sentry:builtin_symbol_sources", result["builtinSymbolSources"]
            ):
                changed_proj_settings["sentry:builtin_symbol_sources"] = result[
                    "builtinSymbolSources"
                ]
        if result.get("symbolSources") is not None:
            if project.update_option("sentry:symbol_sources", result["symbolSources"]):
                # Redact secrets so they don't get logged directly to the Audit Log
                sources_json = result["symbolSources"] or None
                try:
                    sources = parse_sources(sources_json)
                except Exception:
                    sources = []
                redacted_sources = redact_source_secrets(sources)
                changed_proj_settings["sentry:symbol_sources"] = redacted_sources
        if "defaultEnvironment" in result:
            if result["defaultEnvironment"] is None:
                project.delete_option("sentry:default_environment")
            else:
                project.update_option("sentry:default_environment", result["defaultEnvironment"])
        # resolveAge can be None
        if "resolveAge" in result:
            if project.update_option(
                "sentry:resolve_age",
                0 if result.get("resolveAge") is None else int(result["resolveAge"]),
            ):
                changed_proj_settings["sentry:resolve_age"] = result["resolveAge"]
        if result.get("scrapeJavaScript") is not None:
            if project.update_option("sentry:scrape_javascript", result["scrapeJavaScript"]):
                changed_proj_settings["sentry:scrape_javascript"] = result["scrapeJavaScript"]
        if result.get("allowedDomains"):
            if project.update_option("sentry:origins", result["allowedDomains"]):
                changed_proj_settings["sentry:origins"] = result["allowedDomains"]

        if "isSubscribed" in result:
            NotificationSetting.objects.update_settings(
                ExternalProviders.EMAIL,
                NotificationSettingTypes.ISSUE_ALERTS,
                get_option_value_from_boolean(result.get("isSubscribed")),
                user=request.user,
                project=project,
            )

        if "dynamicSamplingBiases" in result:
            updated_biases = get_user_biases(user_set_biases=result["dynamicSamplingBiases"])
            if project.update_option("sentry:dynamic_sampling_biases", updated_biases):
                changed_proj_settings["sentry:dynamic_sampling_biases"] = result[
                    "dynamicSamplingBiases"
                ]
        # TODO(dcramer): rewrite options to use standard API config
        if has_project_write:
            options = request.data.get("options", {})
            if "sentry:origins" in options:
                project.update_option(
                    "sentry:origins", clean_newline_inputs(options["sentry:origins"])
                )
            if "sentry:resolve_age" in options:
                project.update_option("sentry:resolve_age", int(options["sentry:resolve_age"]))
            if "sentry:scrub_data" in options:
                project.update_option("sentry:scrub_data", bool(options["sentry:scrub_data"]))
            if "sentry:scrub_defaults" in options:
                project.update_option(
                    "sentry:scrub_defaults", bool(options["sentry:scrub_defaults"])
                )
            if "sentry:safe_fields" in options:
                project.update_option(
                    "sentry:safe_fields",
                    [s.strip().lower() for s in options["sentry:safe_fields"]],
                )
            if "sentry:store_crash_reports" in options:
                project.update_option(
                    "sentry:store_crash_reports",
                    convert_crashreport_count(
                        options["sentry:store_crash_reports"], allow_none=True
                    ),
                )
            if "sentry:relay_pii_config" in options:
                project.update_option(
                    "sentry:relay_pii_config",
                    options["sentry:relay_pii_config"].strip() or None,
                )
            if "sentry:sensitive_fields" in options:
                project.update_option(
                    "sentry:sensitive_fields",
                    [s.strip().lower() for s in options["sentry:sensitive_fields"]],
                )
            if "sentry:scrub_ip_address" in options:
                project.update_option(
                    "sentry:scrub_ip_address", bool(options["sentry:scrub_ip_address"])
                )
            if "sentry:grouping_config" in options:
                project.update_option("sentry:grouping_config", options["sentry:grouping_config"])
            if "sentry:fingerprinting_rules" in options:
                project.update_option(
                    "sentry:fingerprinting_rules", options["sentry:fingerprinting_rules"]
                )
            if "mail:subject_prefix" in options:
                project.update_option("mail:subject_prefix", options["mail:subject_prefix"])
            if "sentry:default_environment" in options:
                project.update_option(
                    "sentry:default_environment", options["sentry:default_environment"]
                )
            if "sentry:csp_ignored_sources_defaults" in options:
                project.update_option(
                    "sentry:csp_ignored_sources_defaults",
                    bool(options["sentry:csp_ignored_sources_defaults"]),
                )
            if "sentry:csp_ignored_sources" in options:
                project.update_option(
                    "sentry:csp_ignored_sources",
                    clean_newline_inputs(options["sentry:csp_ignored_sources"]),
                )
            if "sentry:blacklisted_ips" in options:
                project.update_option(
                    "sentry:blacklisted_ips",
                    clean_newline_inputs(options["sentry:blacklisted_ips"]),
                )
            if "feedback:branding" in options:
                project.update_option(
                    "feedback:branding", "1" if options["feedback:branding"] else "0"
                )
            if "sentry:reprocessing_active" in options:
                project.update_option(
                    "sentry:reprocessing_active",
                    bool(options["sentry:reprocessing_active"]),
                )
            if "filters:react-hydration-errors" in options:
                project.update_option(
                    "filters:react-hydration-errors",
                    bool(options["filters:react-hydration-errors"]),
                )
            if "filters:blacklisted_ips" in options:
                project.update_option(
                    "sentry:blacklisted_ips",
                    clean_newline_inputs(options["filters:blacklisted_ips"]),
                )
            if f"filters:{FilterTypes.RELEASES}" in options:
                if features.has("projects:custom-inbound-filters", project, actor=request.user):
                    project.update_option(
                        f"sentry:{FilterTypes.RELEASES}",
                        clean_newline_inputs(options[f"filters:{FilterTypes.RELEASES}"]),
                    )
                else:
                    return Response(
                        {"detail": ["You do not have that feature enabled"]}, status=400
                    )
            if f"filters:{FilterTypes.ERROR_MESSAGES}" in options:
                if features.has("projects:custom-inbound-filters", project, actor=request.user):
                    project.update_option(
                        f"sentry:{FilterTypes.ERROR_MESSAGES}",
                        clean_newline_inputs(
                            options[f"filters:{FilterTypes.ERROR_MESSAGES}"],
                            case_insensitive=False,
                        ),
                    )
                else:
                    return Response(
                        {"detail": ["You do not have that feature enabled"]}, status=400
                    )
            if "copy_from_project" in result:
                if not project.copy_settings_from(result["copy_from_project"]):
                    return Response({"detail": ["Copy project settings failed."]}, status=409)

            if "sentry:dynamic_sampling_biases" in changed_proj_settings:
                self.dynamic_sampling_biases_audit_log(
                    project,
                    request,
                    old_data.get("dynamicSamplingBiases"),
                    result.get("dynamicSamplingBiases"),
                )
                if len(changed_proj_settings) == 1:
                    data = serialize(project, request.user, DetailedProjectSerializer())
                    return Response(data)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={**changed_proj_settings, **project.get_audit_log_data()},
        )

        data = serialize(project, request.user, DetailedProjectSerializer())
        if not (
            features.has("organizations:dynamic-sampling", project.organization)
            and sentry_options.get("dynamic-sampling:enabled-biases")
        ):
            data["dynamicSamplingBiases"] = None
        # If here because the case of when no dynamic sampling is enabled at all, you would want to kick
        # out both keys actually

        return Response(data)

    @sudo_required
    def delete(self, request: Request, project) -> Response:
        """
        Delete a Project
        ````````````````

        Schedules a project for deletion.

        Deletion happens asynchronously and therefore is not immediate.
        However once deletion has begun the state of a project changes and
        will be hidden from most public views.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :auth: required
        """
        if project.is_internal_project():
            return Response(
                '{"error": "Cannot remove projects internally used by Sentry."}',
                status=status.HTTP_403_FORBIDDEN,
            )

        updated = Project.objects.filter(id=project.id, status=ObjectStatus.ACTIVE).update(
            status=ObjectStatus.PENDING_DELETION
        )
        if updated:
            scheduled = ScheduledDeletion.schedule(project, days=0, actor=request.user)

            common_audit_data = {
                "request": request,
                "organization": project.organization,
                "target_object": project.id,
                "transaction_id": scheduled.id,
            }

            if request.data.get("origin"):
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_REMOVE_WITH_ORIGIN"),
                    data={
                        **project.get_audit_log_data(),
                        "origin": request.data.get("origin"),
                    },
                )
            else:
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_REMOVE"),
                    data={**project.get_audit_log_data()},
                )

            project.rename_on_pending_deletion()

        return Response(status=204)

    def dynamic_sampling_biases_audit_log(
        self, project, request, old_raw_dynamic_sampling_biases, new_raw_dynamic_sampling_biases
    ):
        """
        Compares the previous and next dynamic sampling biases object, triggering audit logs according to the changes.
        We are currently verifying the following cases:

        Enabling
            We make a loop through the whole object, comparing next with previous biases.
            If we detect that the current bias is disabled and the updated same bias is enabled, this is triggered

        Disabling
            We make a loop through the whole object, comparing next with previous biases.
            If we detect that the current bias is enabled and the updated same bias is disabled, this is triggered


        :old_raw_dynamic_sampling_biases: The dynamic sampling biases object before the changes
        :new_raw_dynamic_sampling_biases: The updated dynamic sampling biases object
        """

        if old_raw_dynamic_sampling_biases is None:
            return

        for index, rule in enumerate(new_raw_dynamic_sampling_biases):
            if rule["active"] != old_raw_dynamic_sampling_biases[index]["active"]:
                self.create_audit_entry(
                    request=request,
                    organization=project.organization,
                    target_object=project.id,
                    event=audit_log.get_event_id(
                        "SAMPLING_BIAS_ENABLED" if rule["active"] else "SAMPLING_BIAS_DISABLED"
                    ),
                    data={**project.get_audit_log_data(), "name": rule["id"]},
                )
                return
