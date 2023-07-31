from sentry.models import EventError, PromptsActivity, SourceMapProcessingIssue
from sentry.utils.request_cache import request_cache

DEFAULT_PROMPTS = {
    "releases": {"required_fields": ["organization_id", "project_id"]},
    "suspect_commits": {"required_fields": ["organization_id", "project_id"]},
    "profiling_onboarding": {"required_fields": ["organization_id"]},
    "alert_stream": {"required_fields": ["organization_id"]},
    "sdk_updates": {"required_fields": ["organization_id"]},
    "suggest_mobile_project": {"required_fields": ["organization_id"]},
    "stacktrace_link": {"required_fields": ["organization_id", "project_id"]},
    "distributed_tracing": {"required_fields": ["organization_id", "project_id"]},
    "quick_trace_missing": {"required_fields": ["organization_id", "project_id"]},
    "code_owners": {"required_fields": ["organization_id", "project_id"]},
    "vitals_alert": {"required_fields": ["organization_id"]},
}

ACTIONABLE_ITEMS_PROMPTS = {
    EventError.INVALID_DATA: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.INVALID_ATTRIBUTE: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.VALUE_TOO_LONG: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.FUTURE_TIMESTAMP: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.PAST_TIMESTAMP: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.CLOCK_DRIFT: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.INVALID_ENVIRONMENT: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.SECURITY_VIOLATION: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.RESTRICTED_IP: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.FETCH_GENERIC_ERROR: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.JS_MISSING_SOURCES_CONTENT: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.JS_SCRAPING_DISABLED: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.NATIVE_BAD_DSYM: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: {
        "reqiured_fields": ["organization_id", "project_id"]
    },
    EventError.NATIVE_MISSING_DSYM: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.PROGUARD_MISSING_LINENO: {"reqiured_fields": ["organization_id", "project_id"]},
    EventError.PROGUARD_MISSING_MAPPING: {"reqiured_fields": ["organization_id", "project_id"]},
    SourceMapProcessingIssue.MISSING_RELEASE: {
        "reqiured_fields": ["organization_id", "project_id"]
    },
    SourceMapProcessingIssue.MISSING_SOURCEMAPS: {
        "reqiured_fields": ["organization_id", "project_id"]
    },
    SourceMapProcessingIssue.URL_NOT_VALID: {"reqiured_fields": ["organization_id", "project_id"]},
    SourceMapProcessingIssue.NO_URL_MATCH: {"reqiured_fields": ["organization_id", "project_id"]},
    SourceMapProcessingIssue.PARTIAL_MATCH: {"reqiured_fields": ["organization_id", "project_id"]},
    SourceMapProcessingIssue.DIST_MISMATCH: {"reqiured_fields": ["organization_id", "project_id"]},
    SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND: {
        "reqiured_fields": ["organization_id", "project_id"]
    },
    SourceMapProcessingIssue.DEBUG_ID_NO_SOURCEMAPS: {
        "reqiured_fields": ["organization_id", "project_id"]
    },
}


class PromptsConfig:
    """
    Used to configure available 'prompts' (frontend modals or UI that may be
    dismissed or have some other action recorded about it). This config
    declares what prompts are available And what fields may be required.

    required_fields available: [organization_id, project_id]
    """

    def __init__(self, prompts):
        self.prompts = prompts

    def add(self, name, config):
        if self.has(name):
            raise Exception(f"Prompt key {name} is already in use")
        if "required_fields" not in config:
            raise Exception("'required_fields' must be present in the config dict")

        self.prompts[name] = config

    def has(self, name):
        return name in self.prompts

    def get(self, name):
        return self.prompts[name]

    def required_fields(self, name):
        return self.prompts[name]["required_fields"]


prompt_config = PromptsConfig(DEFAULT_PROMPTS | ACTIONABLE_ITEMS_PROMPTS)


# TODO: remove get_prompt_activities and use get_prompt_activities_for_user instead
@request_cache
def get_prompt_activities(organization_ids, features):
    return PromptsActivity.objects.filter(
        organization_id__in=organization_ids, feature__in=features
    )


@request_cache
def get_prompt_activities_for_user(organization_ids, user_id, features):
    return PromptsActivity.objects.filter(
        organization_id__in=organization_ids, feature__in=features, user_id=user_id
    )
