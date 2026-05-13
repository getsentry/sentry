import os


# NOTE: this is ugly, but necessary to use django settings and models
def _patch_sentry_init():
    def _initializer():
        import sentry.runner.settings as _ss

        setattr(_ss, "__installed", True)
        _, py, yaml = _ss.discover_configs()

        from sentry.runner import importer

        importer.SENTRY_CONF_PY = py

        from django.conf import settings

        from sentry.runner.initializer import bootstrap_options

        bootstrap_options(settings, yaml)

        from django.apps import apps

        apps.populate(settings.INSTALLED_APPS)

    os.environ["SENTRY_SILO_MODE"] = "CONTROL"
    os.environ["DJANGO_SETTINGS_MODULE"] = "sentry.runner.default_settings"

    _initializer()


def load_config(app):
    _patch_sentry_init()

    app.config.internal_hostname = os.environ.get("APIGW_INTERNAL_HOSTNAME", "localhost")
    app.config.internal_port = os.environ.get("APIGW_INTERNAL_PORT", "8000")
    app.config.internal_fqdn = f"{app.config.internal_hostname}:{app.config.internal_port}"

    app.config.endpoints.control = os.environ.get("APIGW_ENDPOINT_CONTROL", "http://localhost:8002")

    app.config.proxy.timeout = None
    app.config.proxy.max_concurrency = int(os.environ.get("APIGW_PROXY_MAX_CONCURRENCY", 512))
    app.config.proxy.max_failures = int(os.environ.get("APIGW_PROXY_MAX_FAILURES", 32))
    app.config.proxy.failure_window = int(os.environ.get("APIGW_PROXY_FAILURE_WINDOW", 60))

    if proxy_timeout := os.environ.get("APIGW_PROXY_TIMEOUT"):
        app.config.proxy.timeout = int(proxy_timeout)

    app.config.Sentry.environment = os.environ.get("APIGW_SENTRY_ENVIRONMENT", "development")
    app.config.Sentry.dsn = os.environ.get("APIGW_SENTRY_DSN", "")
    app.config.Sentry.release = os.environ.get("GETSENTRY_VERSION_SHA", "latest")

    app.config.Prometheus.metrics_route_hostname = app.config.internal_fqdn
    app.config.Prometheus.enable_ws_metrics = False
    app.config.Prometheus.http_histogram_statuses = [200, 201]
    app.config.Prometheus.http_histogram_buckets = [35, 100, 500, 1000, 5000, "INF"]
    app.config.Prometheus.exclude_routes = ["internal.health"]
