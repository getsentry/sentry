import inspect
import random

import sentry_sdk
from django.conf import settings
from django.urls import resolve
from sentry_sdk.client import get_options
from sentry_sdk.transport import make_transport
from sentry_sdk.utils import logger as sdk_logger

from sentry import options
from sentry.utils import metrics
from sentry.utils.rust import RustInfoIntegration

UNSAFE_FILES = (
    "sentry/event_manager.py",
    "sentry/tasks/process_buffer.py",
    "sentry/ingest/ingest_consumer.py",
    # This consumer lives outside of sentry but is just as unsafe.
    "outcomes_consumer.py",
)

# URLs that should always be sampled
SAMPLED_URL_NAMES = {
    # codeowners
    "sentry-api-0-project-codeowners",
    "sentry-api-0-project-codeowners-details",
    # external teams POST, PUT, DELETE
    "sentry-api-0-external-team",
    "sentry-api-0-external-team-details",
    # external users POST, PUT, DELETE
    "sentry-api-0-organization-external-user",
    "sentry-api-0-organization-external-user-details",
    # integration platform
    "external-issues",
    "sentry-api-0-sentry-app-authorizations",
    # integrations
    "sentry-extensions-jira-issue-hook",
    "sentry-extensions-vercel-webhook",
    "sentry-extensions-vercel-delete",
    "sentry-extensions-vercel-configure",
    "sentry-extensions-vercel-ui-hook",
    "sentry-api-0-group-integration-details",
    # releases
    "sentry-api-0-organization-releases",
    "sentry-api-0-organization-release-details",
    "sentry-api-0-project-releases",
    "sentry-api-0-project-release-details",
    # stats
    "sentry-api-0-organization-stats",
    "sentry-api-0-organization-stats-v2",
    "sentry-api-0-project-stats",
}

SAMPLED_TASKS = {
    "sentry.tasks.send_ping",
}

_SYMBOLICATE_EVENT_TASKS = {
    "sentry.tasks.store.symbolicate_event",
    "sentry.tasks.store.symbolicate_event_from_reprocessing",
}


def _sample_process_event_tasks():
    return random.random() < settings.SENTRY_PROCESS_EVENT_APM_SAMPLING


_PROCESS_EVENT_TASKS = {
    "sentry.tasks.store.process_event",
    "sentry.tasks.store.process_event_from_reprocessing",
}


def _sample_symbolicate_event_tasks():
    return random.random() < settings.SENTRY_SYMBOLICATE_EVENT_APM_SAMPLING


UNSAFE_TAG = "_unsafe"

# Reexport sentry_sdk just in case we ever have to write another shim like we
# did for raven
from sentry_sdk import capture_exception, capture_message, configure_scope, push_scope  # NOQA


def is_current_event_safe():
    """
    Tests the current stack for unsafe locations that would likely cause
    recursion if an attempt to send to Sentry was made.
    """

    with configure_scope() as scope:

        # Scope was explicitly marked as unsafe
        if scope._tags.get(UNSAFE_TAG):
            return False

        project_id = scope._tags.get("processing_event_for_project")

        if project_id and project_id == settings.SENTRY_PROJECT:
            return False

    for _, filename, _, _, _, _ in inspect.stack():
        if filename.endswith(UNSAFE_FILES):
            return False

    return True


def mark_scope_as_unsafe():
    """
    Set the unsafe tag on the SDK scope for outgoing crashe and transactions.

    Marking a scope explicitly as unsafe allows the recursion breaker to
    decide early, before walking the stack and checking for unsafe files.
    """
    with configure_scope() as scope:
        scope.set_tag(UNSAFE_TAG, True)


def set_current_event_project(project_id):
    """
    Set the current project on the SDK scope for outgoing crash reports.

    This is a dedicated function because it is also important for the recursion
    breaker to work. You really should set the project in every task that is
    relevant to event processing, or that task may crash ingesting
    sentry-internal errors, causing infinite recursion.
    """
    with configure_scope() as scope:
        scope.set_tag("processing_event_for_project", project_id)
        scope.set_tag("project", project_id)


def get_project_key():
    from sentry.models import ProjectKey

    if not settings.SENTRY_PROJECT:
        return None

    key = None
    try:
        if settings.SENTRY_PROJECT_KEY is not None:
            key = ProjectKey.objects.get(
                id=settings.SENTRY_PROJECT_KEY, project=settings.SENTRY_PROJECT
            )
        else:
            key = ProjectKey.get_default(settings.SENTRY_PROJECT)
    except Exception as exc:
        # if the relation fails to query or is missing completely, lets handle
        # it gracefully
        sdk_logger.warning(
            "internal-error.unable-to-fetch-project",
            extra={
                "project_id": settings.SENTRY_PROJECT,
                "project_key": settings.SENTRY_PROJECT_KEY,
                "error_message": str(exc),
            },
        )
    if key is None:
        sdk_logger.warning(
            "internal-error.no-project-available",
            extra={
                "project_id": settings.SENTRY_PROJECT,
                "project_key": settings.SENTRY_PROJECT_KEY,
            },
        )
    return key


def _override_on_full_queue(transport, metric_name):
    if transport is None:
        return

    def on_full_queue(*args, **kwargs):
        metrics.incr(metric_name, tags={"reason": "queue_full"})

    transport._worker.on_full_queue = on_full_queue


def traces_sampler(sampling_context):
    # If there's already a sampling decision, just use that
    if sampling_context["parent_sampled"] is not None:
        return sampling_context["parent_sampled"]

    if "celery_job" in sampling_context:
        task_name = sampling_context["celery_job"].get("task")

        if task_name in SAMPLED_TASKS:
            return 1.0

        if task_name in _PROCESS_EVENT_TASKS:
            return _sample_process_event_tasks()

        if task_name in _SYMBOLICATE_EVENT_TASKS:
            return _sample_symbolicate_event_tasks()

    # Resolve the url, and see if we want to set our own sampling
    if "wsgi_environ" in sampling_context:
        try:
            match = resolve(sampling_context["wsgi_environ"].get("PATH_INFO"))
            if match and match.url_name in SAMPLED_URL_NAMES:
                return 1.0
        except Exception:
            # On errors or 404, continue to default sampling decision
            pass

    # Default to the sampling rate in settings
    return float(settings.SENTRY_BACKEND_APM_SAMPLING or 0)


def configure_sdk():
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    assert sentry_sdk.Hub.main.client is None

    sdk_options = dict(settings.SENTRY_SDK_CONFIG)

    relay_dsn = sdk_options.pop("relay_dsn", None)
    internal_project_key = get_project_key()
    upstream_dsn = sdk_options.pop("dsn", None)
    sdk_options["traces_sampler"] = traces_sampler

    if upstream_dsn:
        upstream_transport = make_transport(get_options(dsn=upstream_dsn, **sdk_options))
    else:
        upstream_transport = None

    if relay_dsn:
        relay_transport = make_transport(get_options(dsn=relay_dsn, **sdk_options))
    elif internal_project_key and internal_project_key.dsn_private:
        relay_transport = make_transport(
            get_options(dsn=internal_project_key.dsn_private, **sdk_options)
        )
    else:
        relay_transport = None

    _override_on_full_queue(relay_transport, "internal.uncaptured.events.relay")
    _override_on_full_queue(upstream_transport, "internal.uncaptured.events.upstream")

    class MultiplexingTransport(sentry_sdk.transport.Transport):
        def capture_envelope(self, envelope):
            # Temporarily capture envelope counts to compare to ingested
            # transactions.
            metrics.incr("internal.captured.events.envelopes")
            transaction = envelope.get_transaction_event()

            # Temporarily also capture counts for one specific transaction to check ingested amount
            if (
                transaction
                and transaction.get("transaction")
                == "/api/0/organizations/{organization_slug}/issues/"
            ):
                metrics.incr("internal.captured.events.envelopes.issues")

            if transaction:
                metrics.incr("internal.captured.events.transactions")

            # Assume only transactions get sent via envelopes
            if options.get("transaction-events.force-disable-internal-project"):
                return

            self._capture_anything("capture_envelope", envelope)

        def capture_event(self, event):
            if event.get("type") == "transaction" and options.get(
                "transaction-events.force-disable-internal-project"
            ):
                return

            self._capture_anything("capture_event", event)

        def _capture_anything(self, method_name, *args, **kwargs):
            # Upstream should get the event first because it is most isolated from
            # the this sentry installation.
            if upstream_transport:
                metrics.incr("internal.captured.events.upstream")
                # TODO(mattrobenolt): Bring this back safely.
                # from sentry import options
                # install_id = options.get('sentry:install-id')
                # if install_id:
                #     event.setdefault('tags', {})['install-id'] = install_id
                getattr(upstream_transport, method_name)(*args, **kwargs)

            if relay_transport and options.get("store.use-relay-dsn-sample-rate") == 1:
                if is_current_event_safe():
                    metrics.incr("internal.captured.events.relay")
                    getattr(relay_transport, method_name)(*args, **kwargs)
                else:
                    metrics.incr(
                        "internal.uncaptured.events.relay",
                        skip_internal=False,
                        tags={"reason": "unsafe"},
                    )

    sentry_sdk.init(
        transport=MultiplexingTransport(),
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(event_level=None),
            RustInfoIntegration(),
            RedisIntegration(),
        ],
        **sdk_options,
    )


class RavenShim:
    """Wrapper around sentry-sdk in case people are writing their own
    integrations that rely on this being here."""

    def captureException(self, exc_info=None, **kwargs):
        with sentry_sdk.push_scope() as scope:
            self._kwargs_into_scope(scope, **kwargs)
            return capture_exception(exc_info)

    def captureMessage(self, msg, **kwargs):
        with sentry_sdk.push_scope() as scope:
            self._kwargs_into_scope(scope, **kwargs)
            return capture_message(msg)

    def tags_context(self, tags):
        with sentry_sdk.configure_scope() as scope:
            for k, v in tags.items():
                scope.set_tag(k, v)

    def _kwargs_into_scope(self, scope, extra=None, tags=None, fingerprint=None, request=None):
        for key, value in extra.items() if extra else ():
            scope.set_extra(key, value)
        for key, value in tags.items() if tags else ():
            scope.set_tag(key, value)
        if fingerprint is not None:
            scope.fingerprint = fingerprint


def bind_organization_context(organization):
    helper = settings.SENTRY_ORGANIZATION_CONTEXT_HELPER

    # XXX(dcramer): this is duplicated in organizationContext.jsx on the frontend
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("organization", organization.id)
        scope.set_tag("organization.slug", organization.slug)
        scope.set_context("organization", {"id": organization.id, "slug": organization.slug})
        if helper:
            try:
                helper(scope=scope, organization=organization)
            except Exception:
                sdk_logger.exception(
                    "internal-error.organization-context",
                    extra={"organization_id": organization.id},
                )
