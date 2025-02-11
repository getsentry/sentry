import logging
import math
import time
from datetime import timedelta
from uuid import uuid4

import orjson
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ListField

from sentry import audit_log, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.decorators import sudo_required
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import DetailedProjectSerializer
from sentry.api.serializers.rest_framework.list import EmptyListField
from sentry.api.serializers.rest_framework.origin import OriginField
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.constants import (
    PROJECT_SLUG_MAX_LENGTH,
    RESERVED_PROJECT_SLUGS,
    SAMPLING_MODE_DEFAULT,
    ObjectStatus,
)
from sentry.datascrubbing import validate_pii_config_update, validate_pii_selectors
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.dynamic_sampling import get_supported_biases_ids, get_user_biases
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.dynamic_sampling.utils import has_custom_dynamic_sampling, has_dynamic_sampling
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.enhancer.exceptions import InvalidEnhancerConfig
from sentry.grouping.fingerprinting import FingerprintingRules, InvalidFingerprintingConfig
from sentry.ingest.inbound_filters import FilterTypes
from sentry.issues.highlights import HighlightContextField
from sentry.lang.native.sources import (
    InvalidSourcesError,
    parse_backfill_sources,
    parse_sources,
    redact_source_secrets,
)
from sentry.lang.native.utils import STORE_CRASH_REPORTS_MAX, convert_crashreport_count
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.projectredirect import ProjectRedirect
from sentry.notifications.utils import has_alert_integration
from sentry.tasks.delete_seer_grouping_records import call_seer_delete_project_grouping_records
from sentry.tempest.utils import has_tempest_access

logger = logging.getLogger(__name__)


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
    isBookmarked = serializers.BooleanField(
        help_text="Enables starring the project within the projects tab. Can be updated with **`project:read`** permission.",
        required=False,
    )


@extend_schema_serializer(
    exclude_fields=[
        "options",
        "team",
        "digestsMinDelay",
        "digestsMaxDelay",
        "securityToken",
        "securityTokenHeader",
        "verifySSL",
        "defaultEnvironment",
        "dataScrubber",
        "dataScrubberDefaults",
        "sensitiveFields",
        "safeFields",
        "storeCrashReports",
        "relayPiiConfig",
        "builtinSymbolSources",
        "symbolSources",
        "scrubIPAddresses",
        "groupingConfig",
        "groupingEnhancements",
        "fingerprintingRules",
        "secondaryGroupingConfig",
        "secondaryGroupingExpiry",
        "scrapeJavaScript",
        "allowedDomains",
        "copy_from_project",
        "targetSampleRate",
        "dynamicSamplingBiases",
        "performanceIssueCreationRate",
        "performanceIssueCreationThroughPlatform",
        "performanceIssueSendToPlatform",
        "uptimeAutodetection",
        "tempestFetchScreenshots",
    ]
)
class ProjectAdminSerializer(ProjectMemberSerializer):
    name = serializers.CharField(
        help_text="The name for the project",
        max_length=200,
        required=False,
    )
    slug = SentrySerializerSlugField(
        help_text="Uniquely identifies a project and is used for the interface.",
        max_length=PROJECT_SLUG_MAX_LENGTH,
        required=False,
    )
    platform = serializers.CharField(
        help_text="The platform for the project",
        required=False,
        allow_null=True,
        allow_blank=True,
    )

    subjectPrefix = serializers.CharField(
        help_text="Custom prefix for emails from this project.",
        max_length=200,
        allow_blank=True,
        required=False,
    )
    subjectTemplate = serializers.CharField(
        help_text="""The email subject to use (excluding the prefix) for individual alerts. Here are the list of variables you can use:
- `$title`
- `$shortID`
- `$projectID`
- `$orgID`
- `${tag:key}` - such as `${tag:environment}` or `${tag:release}`.""",
        max_length=200,
        required=False,
    )
    resolveAge = EmptyIntegerField(
        required=False,
        allow_null=True,
        help_text="Automatically resolve an issue if it hasn't been seen for this many hours. Set to `0` to disable auto-resolve.",
    )
    highlightContext = HighlightContextField(
        required=False,
        help_text="""A JSON mapping of context types to lists of strings for their keys.
E.g. `{'user': ['id', 'email']}`""",
    )
    highlightTags = ListField(
        child=serializers.CharField(),
        required=False,
        help_text="""A list of strings with tag keys to highlight on this project's issues.
E.g. `['release', 'environment']`""",
    )
    # TODO: Add help_text to all the fields for public documentation, then remove them from 'exclude_fields'
    team = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50)
    digestsMinDelay = serializers.IntegerField(min_value=60, max_value=3600)
    digestsMaxDelay = serializers.IntegerField(min_value=60, max_value=3600)
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
    scrapeJavaScript = serializers.BooleanField(required=False)
    allowedDomains = EmptyListField(child=OriginField(allow_blank=True), required=False)

    copy_from_project = serializers.IntegerField(required=False)
    targetSampleRate = serializers.FloatField(required=False, min_value=0, max_value=1)
    dynamicSamplingBiases = DynamicSamplingBiasSerializer(required=False, many=True)
    performanceIssueCreationRate = serializers.FloatField(required=False, min_value=0, max_value=1)
    performanceIssueCreationThroughPlatform = serializers.BooleanField(required=False)
    performanceIssueSendToPlatform = serializers.BooleanField(required=False)
    uptimeAutodetection = serializers.BooleanField(required=False)
    tempestFetchScreenshots = serializers.BooleanField(required=False)

    # DO NOT ADD MORE TO OPTIONS
    # Each param should be a field in the serializer like above.
    # Keeping options here for backward compatibility but removing it from documentation.
    options = serializers.DictField(
        required=False,
    )

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

    def validate_slug(self, slug: str) -> str:
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

    def validate_symbolSources(self, sources_json) -> str:
        if not sources_json:
            return sources_json

        from sentry import features

        organization = self.context["project"].organization
        request = self.context["request"]

        try:
            # We should really only grab and parse if there are sources in sources_json whose
            # secrets are set to {"hidden-secret":true}
            orig_sources = parse_sources(
                self.context["project"].get_option("sentry:symbol_sources"),
                filter_appconnect=True,
            )
            sources = parse_backfill_sources(sources_json.strip(), orig_sources)
        except InvalidSourcesError as e:
            raise serializers.ValidationError(str(e))

        # If no sources are added or modified, we're either only deleting sources or doing nothing.
        # This is always allowed.
        added_or_modified_sources = [s for s in sources if s not in orig_sources]
        if not added_or_modified_sources:
            return orjson.dumps(sources).decode() if sources else ""

        # All modified sources should get a new UUID, as a way to invalidate caches.
        # Downstream symbolicator uses this ID as part of a cache key, so assigning
        # a new ID does have the following effects/tradeoffs:
        # * negative cache entries (eg auth errors) are retried immediately.
        # * positive caches are re-fetches as well, making it less effective.
        for source in added_or_modified_sources:
            source["id"] = str(uuid4())

        sources_json = orjson.dumps(sources).decode() if sources else ""

        # Adding sources is only allowed if custom symbol sources are enabled.
        has_sources = features.has(
            "organizations:custom-symbol-sources", organization, actor=request.user
        )

        if not has_sources:
            raise serializers.ValidationError(
                "Organization is not allowed to set custom symbol sources"
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

    def validate_safeFields(self, value):
        return validate_pii_selectors(value)

    def validate_targetSampleRate(self, value):
        organization = self.context["project"].organization
        actor = self.context["request"].user
        if not has_custom_dynamic_sampling(organization, actor=actor):
            raise serializers.ValidationError(
                "Organization does not have the custom dynamic sample rate feature enabled."
            )

        if (
            organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
            != DynamicSamplingMode.PROJECT.value
        ):
            raise serializers.ValidationError(
                "Must enable Manual Mode to configure project sample rates."
            )

        return value

    def validate_tempestFetchScreenshots(self, value):
        organization = self.context["project"].organization
        actor = self.context["request"].user
        if not has_tempest_access(organization, actor=actor):
            raise serializers.ValidationError(
                "Organization does not have the tempest feature enabled."
            )
        return value


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        # PUT checks for permissions based on fields
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class RelaxedProjectAndStaffPermission(StaffPermissionMixin, RelaxedProjectPermission):
    pass


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (RelaxedProjectAndStaffPermission,)

    def _get_unresolved_count(self, project):
        queryset = Group.objects.filter(status=GroupStatus.UNRESOLVED, project=project)

        resolve_age = project.get_option("sentry:resolve_age", None)
        if resolve_age:
            queryset = queryset.filter(
                last_seen__gte=timezone.now() - timedelta(hours=int(resolve_age))
            )

        return queryset.count()

    @extend_schema(
        operation_id="Retrieve a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: DetailedProjectSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DETAILED_PROJECT,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Return details on an individual project.
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
        if has_dynamic_sampling(project.organization):
            ds_bias_serializer = DynamicSamplingBiasSerializer(
                data=get_user_biases(project.get_option("sentry:dynamic_sampling_biases", None)),
                many=True,
            )
            if not ds_bias_serializer.is_valid():
                return Response(ds_bias_serializer.errors, status=400)
            data["dynamicSamplingBiases"] = ds_bias_serializer.data
        else:
            data["dynamicSamplingBiases"] = None

        # filter for enabled plugins o/w the response body is gigantic and difficult to read
        data["plugins"] = [plugin for plugin in data["plugins"] if plugin.get("enabled")]

        return Response(data)

    @extend_schema(
        operation_id="Update a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=ProjectAdminSerializer,
        responses={
            200: DetailedProjectSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.DETAILED_PROJECT,
    )
    def put(self, request: Request, project) -> Response:
        """
        Update various attributes and configurable settings for the given project.

        Note that solely having the **`project:read`** scope restricts updatable settings to
        `isBookmarked`.
        """

        old_data = serialize(project, request.user, DetailedProjectSerializer())
        has_elevated_scopes = request.access and (
            request.access.has_scope("project:write")
            or request.access.has_scope("project:admin")
            or request.access.has_any_project_scope(project, ["project:write", "project:admin"])
        )

        if has_elevated_scopes:
            serializer_cls: type[ProjectMemberSerializer] = ProjectAdminSerializer
        else:
            serializer_cls = ProjectMemberSerializer

        serializer = serializer_cls(
            data=request.data, partial=True, context={"project": project, "request": request}
        )
        serializer.is_valid()

        result = serializer.validated_data

        if result.get("dynamicSamplingBiases") and not (has_dynamic_sampling(project.organization)):
            return Response(
                {"detail": "dynamicSamplingBiases is not a valid field"},
                status=403,
            )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if not has_elevated_scopes:
            for key in ProjectAdminSerializer().fields.keys():
                if request.data.get(key) and not result.get(key):
                    return Response(
                        {"detail": "You do not have permission to perform this action."},
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
                with transaction.atomic(router.db_for_write(ProjectBookmark)):
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
        if result.get("highlightContext") is not None:
            if project.update_option("sentry:highlight_context", result["highlightContext"]):
                changed_proj_settings["sentry:highlight_context"] = result["highlightContext"]
        if result.get("highlightTags") is not None:
            if project.update_option("sentry:highlight_tags", result["highlightTags"]):
                changed_proj_settings["sentry:highlight_tags"] = result["highlightTags"]
        if "storeCrashReports" in result:
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
                    sources = parse_sources(sources_json, filter_appconnect=True)
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
        if result.get("tempestFetchScreenshots") is not None:
            if project.update_option(
                "sentry:tempest_fetch_screenshots", result["tempestFetchScreenshots"]
            ):
                changed_proj_settings["sentry:tempest_fetch_screenshots"] = result[
                    "tempestFetchScreenshots"
                ]
        if result.get("targetSampleRate") is not None:
            if project.update_option(
                "sentry:target_sample_rate", round(result["targetSampleRate"], 4)
            ):
                changed_proj_settings["sentry:target_sample_rate"] = round(
                    result["targetSampleRate"], 4
                )
        if "dynamicSamplingBiases" in result:
            updated_biases = get_user_biases(user_set_biases=result["dynamicSamplingBiases"])
            if project.update_option("sentry:dynamic_sampling_biases", updated_biases):
                changed_proj_settings["sentry:dynamic_sampling_biases"] = result[
                    "dynamicSamplingBiases"
                ]

        if result.get("uptimeAutodetection") is not None:
            if project.update_option("sentry:uptime_autodetection", result["uptimeAutodetection"]):
                changed_proj_settings["sentry:uptime_autodetection"] = result["uptimeAutodetection"]

        if has_elevated_scopes:
            options = result.get("options", {})
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
            if "sentry:replay_rage_click_issues" in options:
                project.update_option(
                    "sentry:replay_rage_click_issues",
                    bool(options["sentry:replay_rage_click_issues"]),
                )
            if "sentry:replay_hydration_error_issues" in options:
                project.update_option(
                    "sentry:replay_hydration_error_issues",
                    bool(options["sentry:replay_hydration_error_issues"]),
                )
            if "sentry:feedback_user_report_notifications" in options:
                project.update_option(
                    "sentry:feedback_user_report_notifications",
                    bool(options["sentry:feedback_user_report_notifications"]),
                )
            if "sentry:feedback_ai_spam_detection" in options:
                project.update_option(
                    "sentry:feedback_ai_spam_detection",
                    bool(options["sentry:feedback_ai_spam_detection"]),
                )
            if "sentry:toolbar_allowed_origins" in options:
                project.update_option(
                    "sentry:toolbar_allowed_origins",
                    clean_newline_inputs(options["sentry:toolbar_allowed_origins"]),
                )
            if "filters:react-hydration-errors" in options:
                project.update_option(
                    "filters:react-hydration-errors",
                    "1" if bool(options["filters:react-hydration-errors"]) else "0",
                )
            if "filters:chunk-load-error" in options:
                project.update_option(
                    "filters:chunk-load-error",
                    "1" if bool(options["filters:chunk-load-error"]) else "0",
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
                    return Response({"detail": "You do not have that feature enabled"}, status=400)
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
                    return Response({"detail": "You do not have that feature enabled"}, status=400)
            if "copy_from_project" in result:
                if not project.copy_settings_from(result["copy_from_project"]):
                    return Response({"detail": "Copy project settings failed."}, status=409)

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

            if "sentry:uptime_autodetection" in options:
                project.update_option(
                    "sentry:uptime_autodetection", bool(options["sentry:uptime_autodetection"])
                )

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={**changed_proj_settings, **project.get_audit_log_data()},
        )

        data = serialize(project, request.user, DetailedProjectSerializer())
        if not has_dynamic_sampling(project.organization):
            data["dynamicSamplingBiases"] = None
        # If here because the case of when no dynamic sampling is enabled at all, you would want to kick
        # out both keys actually

        return Response(data)

    @extend_schema(
        operation_id="Delete a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @sudo_required
    def delete(self, request: Request, project) -> Response:
        """
        Schedules a project for deletion.

        Deletion happens asynchronously and therefore is not immediate. However once deletion has
        begun the state of a project changes and will be hidden from most public views.
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
            scheduled = RegionScheduledDeletion.schedule(project, days=0, actor=request.user)

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

            # Tell seer to delete all the project's grouping records
            if project.get_option("sentry:similarity_backfill_completed"):
                call_seer_delete_project_grouping_records.apply_async(args=[project.id])

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
