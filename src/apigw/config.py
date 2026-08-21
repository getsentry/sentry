import os

from emmett55 import App


# NOTE: this is ugly, but necessary to use django settings and models
def _patch_sentry_init() -> None:
    from django.apps import apps

    # Django was already initialized by the host process (e.g. pytest);
    # don't re-bootstrap sentry on top of it.
    if apps.ready:
        return

    def _initializer() -> None:
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


def load_config(app: App) -> None:
    _patch_sentry_init()

    app.config.handle_static = False

    app.config.internal_hostname = os.environ.get("APIGW_INTERNAL_HOSTNAME", "localhost")
    app.config.internal_port = os.environ.get("APIGW_INTERNAL_PORT", "8000")
    app.config.internal_fqdn = f"{app.config.internal_hostname}:{app.config.internal_port}"

    app.config.AsyncPG.pool_size = int(os.environ.get("APIGW_DB_POOL_SIZE", 4))

    app.config.endpoints.control = os.environ.get("APIGW_ENDPOINT_CONTROL", "http://localhost:8002")
    app.config.endpoints.use_cell_gw = bool(os.environ.get("APIGW_USE_CELL_GW_ENDPOINTS"))

    app.config.proxy.timeout = None
    app.config.proxy.max_concurrency = int(os.environ.get("APIGW_PROXY_MAX_CONCURRENCY", 512))
    app.config.proxy.max_failures = int(os.environ.get("APIGW_PROXY_MAX_FAILURES", 16))
    app.config.proxy.failure_window = int(os.environ.get("APIGW_PROXY_FAILURE_WINDOW", 60))
    app.config.proxy.latency_buckets = [50, 100, 250, 1000, 10000, 60000]

    app.config.proxy.client_max_connections = None
    app.config.proxy.client_keepalive_max_connections = None
    app.config.proxy.client_keepalive_timeout = int(
        os.environ.get("APIGW_PROXY_KEEPALIVE_TIMEOUT", 95)
    )

    if proxy_timeout := os.environ.get("APIGW_PROXY_TIMEOUT"):
        app.config.proxy.timeout = int(proxy_timeout)

    if proxy_client_max_conns := os.environ.get("APIGW_PROXY_MAX_CONNS"):
        app.config.proxy.client_max_connections = int(proxy_client_max_conns)

    if proxy_client_keepalive_max := os.environ.get("APIGW_PROXY_KEEPALIVE"):
        app.config.proxy.client_keepalive_max_connections = int(proxy_client_keepalive_max)

    app.config.Sentry.environment = os.environ.get("APIGW_SENTRY_ENVIRONMENT", "development")
    app.config.Sentry.dsn = os.environ.get("APIGW_SENTRY_DSN", "")
    app.config.Sentry.release = os.environ.get("GETSENTRY_VERSION_SHA", "latest")

    if sentry_tracing_sample_rate := os.environ.get("APIGW_SENTRY_TRACING_SAMPLE_RATE"):
        app.config.Sentry.enable_tracing = True
        app.config.Sentry.tracing_sample_rate = float(sentry_tracing_sample_rate)
        app.config.Sentry.tracing_exclude_routes = ["emmett_prometheus.metrics", "internal.health"]

    app.config.Prometheus.metrics_route_hostname = app.config.internal_fqdn
    app.config.Prometheus.enable_ws_metrics = False
    app.config.Prometheus.http_histogram_buckets = [35, 100, 500, 1000, 5000]
    app.config.Prometheus.exclude_routes = ["internal.health"]

    from django.conf import settings

    app.config.cells.default = settings.SENTRY_FALLBACK_CELL
