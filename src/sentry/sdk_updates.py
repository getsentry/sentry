import logging
from distutils.version import LooseVersion

from django.conf import settings
from django.core.cache import cache

from sentry.tasks.release_registry import SDK_INDEX_CACHE_KEY
from sentry.utils.compat import zip
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


class SdkSetupState:
    def __init__(self, sdk_name, sdk_version, modules, integrations):
        self.sdk_name = sdk_name
        self.sdk_version = sdk_version
        self.modules = dict(modules or ())
        self.integrations = list(integrations or ())

    def copy(self):
        return type(self)(
            sdk_name=self.sdk_name,
            sdk_version=self.sdk_version,
            modules=self.modules,
            integrations=self.integrations,
        )

    @classmethod
    def from_event_json(cls, event_data):
        sdk_name = get_path(event_data, "sdk", "name")
        if sdk_name:
            sdk_name = sdk_name.lower().rsplit(":", 1)[0]

        if sdk_name == "sentry-python":
            sdk_name = "sentry.python"

        return cls(
            sdk_name=sdk_name,
            sdk_version=get_path(event_data, "sdk", "version"),
            modules=get_path(event_data, "modules"),
            integrations=get_path(event_data, "sdk", "integrations"),
        )


class SdkIndexState:
    def __init__(self, sdk_versions=None, deprecated_sdks=None, sdk_supported_modules=None):
        self.sdk_versions = sdk_versions or get_sdk_versions()
        self.deprecated_sdks = deprecated_sdks or settings.DEPRECATED_SDKS
        self.sdk_supported_modules = sdk_supported_modules or SDK_SUPPORTED_MODULES


class Suggestion:
    def to_json(self):
        raise NotImplementedError()

    def __eq__(self, other):
        return self.to_json() == other.to_json()


class EnableIntegrationSuggestion(Suggestion):
    def __init__(self, integration_name, integration_url):
        self.integration_name = integration_name
        self.integration_url = integration_url

    def to_json(self):
        return {
            "type": "enableIntegration",
            "integrationName": self.integration_name,
            "integrationUrl": self.integration_url,
        }

    def get_new_state(self, old_state):
        if self.integration_name in old_state.integrations:
            return old_state

        new_state = old_state.copy()
        new_state.integrations.append(self.integration_name)
        return new_state


class UpdateSDKSuggestion(Suggestion):
    def __init__(self, sdk_name, new_sdk_version, ignore_patch_version):
        self.sdk_name = sdk_name
        self.new_sdk_version = new_sdk_version
        self.ignore_patch_version = ignore_patch_version

    def to_json(self):
        return {
            "type": "updateSdk",
            "sdkName": self.sdk_name,
            "newSdkVersion": self.new_sdk_version,
            "sdkUrl": get_sdk_urls().get(self.sdk_name),
        }

    def get_new_state(self, old_state):
        if self.new_sdk_version is None:
            return old_state

        new_sdk_version = self.new_sdk_version
        if self.ignore_patch_version:
            new_sdk_version = ".".join(v for v in new_sdk_version.split(".")[:2])

        try:
            has_newer_version = LooseVersion(old_state.sdk_version) < LooseVersion(new_sdk_version)
        except Exception:
            has_newer_version = False

        if not has_newer_version:
            return old_state

        new_state = old_state.copy()
        new_state.sdk_version = self.new_sdk_version
        return new_state


class ChangeSDKSuggestion(Suggestion):
    """
    :param module_names: Hide this suggestion if any of the given modules is
        loaded. This list is used to weed out invalid suggestions when using
        multiple SDKs in e.g. .NET.
    """

    def __init__(self, new_sdk_name, module_names=None):
        self.new_sdk_name = new_sdk_name
        self.module_names = module_names

    def to_json(self):
        return {
            "type": "changeSdk",
            "newSdkName": self.new_sdk_name,
            "sdkUrl": get_sdk_urls().get(self.new_sdk_name),
        }

    def get_new_state(self, old_state):
        if old_state.sdk_name == self.new_sdk_name:
            return old_state

        if any(x in old_state.modules for x in self.module_names or ()):
            return old_state

        new_state = old_state.copy()
        new_state.sdk_name = self.new_sdk_name
        return new_state


SDK_SUPPORTED_MODULES = [
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.3.2",
        "module_name": "django",
        "module_version_min": "1.6.0",
        "suggestion": EnableIntegrationSuggestion(
            "django", "https://docs.sentry.io/platforms/python/django/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.3.2",
        "module_name": "flask",
        "module_version_min": "0.11.0",
        "suggestion": EnableIntegrationSuggestion(
            "flask", "https://docs.sentry.io/platforms/python/flask/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.7.9",
        "module_name": "bottle",
        "module_version_min": "0.12.0",
        "suggestion": EnableIntegrationSuggestion(
            "bottle", "https://docs.sentry.io/platforms/python/bottle/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.7.11",
        "module_name": "falcon",
        "module_version_min": "1.4.0",
        "suggestion": EnableIntegrationSuggestion(
            "falcon", "https://docs.sentry.io/platforms/python/falcon/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.3.6",
        "module_name": "sanic",
        "module_version_min": "0.8.0",
        "suggestion": EnableIntegrationSuggestion(
            "sanic", "https://docs.sentry.io/platforms/python/sanic/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.3.2",
        "module_name": "celery",
        "module_version_min": "3.0.0",
        "suggestion": EnableIntegrationSuggestion(
            "celery", "https://docs.sentry.io/platforms/python/celery/"
        ),
    },
    # TODO: Detect AWS Lambda for Python
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.5.0",
        "module_name": "pyramid",
        "module_version_min": "1.3.0",
        "suggestion": EnableIntegrationSuggestion(
            "pyramid", "https://docs.sentry.io/platforms/python/pyramid/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.5.1",
        "module_name": "rq",
        "module_version_min": "0.6",
        "suggestion": EnableIntegrationSuggestion(
            "rq", "https://docs.sentry.io/platforms/python/rq/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.6.1",
        "module_name": "aiohttp",
        "module_version_min": "3.4.0",
        "suggestion": EnableIntegrationSuggestion(
            "aiohttp", "https://docs.sentry.io/platforms/python/aiohttp/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.6.3",
        "module_name": "tornado",
        "module_version_min": "5.0.0",
        "suggestion": EnableIntegrationSuggestion(
            "tornado", "https://docs.sentry.io/platforms/python/tornado/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.10.0",
        "module_name": "redis",
        "module_version_min": "0.0.0",
        "suggestion": EnableIntegrationSuggestion(
            "redis", "https://docs.sentry.io/platforms/python/redis/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.11.0",
        "module_name": "sqlalchemy",
        "module_version_min": "1.2.0",
        "suggestion": EnableIntegrationSuggestion(
            "sqlalchemy", "https://docs.sentry.io/platforms/python/sqlalchemy/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.11.0",
        "module_name": "apache_beam",
        "module_version_min": "2.12.0",
        "suggestion": EnableIntegrationSuggestion(
            "beam", "https://docs.sentry.io/platforms/python/beam/"
        ),
    },
    {
        "sdk_name": "sentry.python",
        "sdk_version_added": "0.13.0",
        "module_name": "pyspark",
        "module_version_min": "2.0.0",
        "suggestion": EnableIntegrationSuggestion(
            "spark", "https://docs.sentry.io/platforms/python/pyspark/"
        ),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "Microsoft.AspNetCore.Hosting",
        "module_version_min": "2.1.0",
        "suggestion": ChangeSDKSuggestion("sentry.dotnet.aspnetcore", ["Sentry.AspNetCore"]),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "EntityFramework",
        "module_version_min": "6.0.0",
        "suggestion": ChangeSDKSuggestion(
            "sentry.dotnet.entityframework", ["Sentry.EntityFramework"]
        ),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "log4net",
        "module_version_min": "2.0.8",
        "suggestion": ChangeSDKSuggestion("sentry.dotnet.log4net", ["Sentry.Log4Net"]),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "Microsoft.Extensions.Logging.Configuration",
        "module_version_min": "2.1.0",
        "suggestion": ChangeSDKSuggestion(
            "sentry.dotnet.extensions.logging",
            [
                "Sentry.Extensions.Logging",
                # If AspNetCore is used, do not show this suggestion at all,
                # because the (hopefully visible) suggestion to use the
                # AspNetCore SDK is more specific.
                "Microsoft.AspNetCore.Hosting",
            ],
        ),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "Serilog",
        "module_version_min": "2.7.1",
        "suggestion": ChangeSDKSuggestion("sentry.dotnet.serilog", ["Sentry.Serilog"]),
    },
    {
        "sdk_name": "sentry.dotnet",
        "sdk_version_added": "0.0.0",
        "module_name": "NLog",
        "module_version_min": "4.6.0",
        "suggestion": ChangeSDKSuggestion("sentry.dotnet.nlog", ["Sentry.NLog"]),
    },
]


def get_sdk_index():
    """
    Get the SDK index from cache, if available.

    The cache is filled by a regular background task (see sentry/tasks/release_registry)
    """
    if not settings.SENTRY_RELEASE_REGISTRY_BASEURL:
        return {}

    return cache.get(SDK_INDEX_CACHE_KEY) or {}


def get_sdk_versions():
    try:
        rv = settings.SDK_VERSIONS
        rv.update((key, info["version"]) for (key, info) in get_sdk_index().items())
        return rv
    except Exception:
        logger.exception("sentry-release-registry.sdk-versions")
        return {}


def get_sdk_urls():
    try:
        rv = dict(settings.SDK_URLS)
        rv.update((key, info["main_docs_url"]) for (key, info) in get_sdk_index().items())
        return rv
    except Exception:
        logger.exception("sentry-release-registry.sdk-urls")
        return {}


def _get_suggested_updates_step(setup_state, index_state, ignore_patch_version):
    if not setup_state.sdk_name or not setup_state.sdk_version:
        return

    yield UpdateSDKSuggestion(
        setup_state.sdk_name,
        index_state.sdk_versions.get(setup_state.sdk_name),
        ignore_patch_version,
    )

    # If an SDK is both outdated and entirely deprecated, we want to inform
    # the user of both. It's unclear if they would want to upgrade the SDK
    # or migrate to the new one.
    newest_name = settings.DEPRECATED_SDKS.get(setup_state.sdk_name, setup_state.sdk_name)
    yield ChangeSDKSuggestion(newest_name)

    for support_info in SDK_SUPPORTED_MODULES:
        if support_info["sdk_name"] != setup_state.sdk_name and not setup_state.sdk_name.startswith(
            support_info["sdk_name"] + "."
        ):
            continue

        if support_info["module_name"] not in setup_state.modules:
            continue

        try:
            if LooseVersion(support_info["sdk_version_added"]) > LooseVersion(
                setup_state.sdk_version
            ):
                continue
        except Exception:
            continue

        try:
            if LooseVersion(support_info["module_version_min"]) > LooseVersion(
                setup_state.modules[support_info["module_name"]]
            ):
                # TODO(markus): Maybe we want to suggest people to upgrade their module?
                #
                # E.g. "please upgrade Django so you can get the Django
                # integration"
                continue
        except Exception:
            continue

        yield support_info["suggestion"]


def get_suggested_updates(
    setup_state, index_state=None, parent_suggestions=None, ignore_patch_version=False
):
    if index_state is None:
        index_state = SdkIndexState()

    if parent_suggestions is None:
        parent_suggestions = []

    suggestions = list(_get_suggested_updates_step(setup_state, index_state, ignore_patch_version))

    rv = []
    new_setup_states = []

    for suggestion in suggestions:
        if suggestion in parent_suggestions:
            continue

        new_setup_state = suggestion.get_new_state(setup_state)
        if new_setup_state == setup_state:
            continue

        rv.append(suggestion)
        new_setup_states.append(new_setup_state)

    for new_setup_state, suggestion in zip(new_setup_states, rv):
        json = suggestion.to_json()
        json["enables"] = list(
            get_suggested_updates(
                new_setup_state, parent_suggestions=parent_suggestions + rv, index_state=index_state
            )
        )

        yield json
