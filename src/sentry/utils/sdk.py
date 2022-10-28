import copy
import inspect
import random

import sentry_sdk
from django.conf import settings
from django.urls import resolve

# Reexport sentry_sdk just in case we ever have to write another shim like we
# did for raven
from sentry_sdk import capture_exception, capture_message, configure_scope, push_scope  # NOQA
from sentry_sdk.client import get_options
from sentry_sdk.transport import make_transport
from sentry_sdk.utils import logger as sdk_logger

from sentry import options
from sentry.utils import metrics
from sentry.utils.db import DjangoAtomicIntegration
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
    "sentry-api-0-project-codeowners": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-project-codeowners-details": settings.SAMPLED_DEFAULT_RATE,
    # external teams POST, PUT, DELETE
    "sentry-api-0-external-team": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-external-team-details": settings.SAMPLED_DEFAULT_RATE,
    # external users POST, PUT, DELETE
    "sentry-api-0-organization-external-user": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-organization-external-user-details": settings.SAMPLED_DEFAULT_RATE,
    # integration platform
    "external-issues": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-sentry-app-authorizations": settings.SAMPLED_DEFAULT_RATE,
    # integrations
    "sentry-extensions-jira-issue-hook": 0.05,
    "sentry-extensions-vercel-webhook": settings.SAMPLED_DEFAULT_RATE,
    "sentry-extensions-vercel-generic-webhook": settings.SAMPLED_DEFAULT_RATE,
    "sentry-extensions-vercel-configure": settings.SAMPLED_DEFAULT_RATE,
    "sentry-extensions-vercel-ui-hook": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-group-integration-details": settings.SAMPLED_DEFAULT_RATE,
    # notification platform
    "sentry-api-0-user-notification-settings": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-team-notification-settings": settings.SAMPLED_DEFAULT_RATE,
    # events
    "sentry-api-0-organization-events": 1,
    # releases
    "sentry-api-0-organization-releases": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-organization-release-details": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-project-releases": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-project-release-details": settings.SAMPLED_DEFAULT_RATE,
    # stats
    "sentry-api-0-organization-stats": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-organization-stats-v2": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-project-stats": 0.05,  # lower rate because of high TPM
    # debug files
    "sentry-api-0-assemble-dif-files": 0.1,
    # scim
    "sentry-api-0-organization-scim-member-index": 0.1,
    "sentry-api-0-organization-scim-member-details": 0.1,
    "sentry-api-0-organization-scim-team-index": 0.1,
    "sentry-api-0-organization-scim-team-details": 0.1,
    # members
    "sentry-api-0-organization-invite-request-index": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-organization-invite-request-detail": settings.SAMPLED_DEFAULT_RATE,
    "sentry-api-0-organization-join-request": settings.SAMPLED_DEFAULT_RATE,
    # login
    "sentry-login": 0.1,
    "sentry-auth-organization": 0.2,
    "sentry-auth-link-identity": settings.SAMPLED_DEFAULT_RATE,
    "sentry-auth-sso": settings.SAMPLED_DEFAULT_RATE,
    "sentry-logout": 0.1,
    "sentry-register": settings.SAMPLED_DEFAULT_RATE,
    "sentry-2fa-dialog": settings.SAMPLED_DEFAULT_RATE,
    # reprocessing
    "sentry-api-0-issues-reprocessing": settings.SENTRY_REPROCESSING_APM_SAMPLING,
}
if settings.ADDITIONAL_SAMPLED_URLS:
    SAMPLED_URL_NAMES.update(settings.ADDITIONAL_SAMPLED_URLS)

# Tasks not included here are not sampled
# If a parent task schedules other tasks you should add it in here or the children
# tasks will not be sampled
SAMPLED_TASKS = {
    "sentry.tasks.send_ping": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.store.symbolicate_event": settings.SENTRY_SYMBOLICATE_EVENT_APM_SAMPLING,
    "sentry.tasks.store.symbolicate_event_from_reprocessing": settings.SENTRY_SYMBOLICATE_EVENT_APM_SAMPLING,
    "sentry.tasks.store.process_event": settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
    "sentry.tasks.store.process_event_from_reprocessing": settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
    "sentry.tasks.assemble.assemble_dif": 0.1,
    "sentry.tasks.app_store_connect.dsym_download": settings.SENTRY_APPCONNECT_APM_SAMPLING,
    "sentry.tasks.app_store_connect.refresh_all_builds": settings.SENTRY_APPCONNECT_APM_SAMPLING,
    "sentry.tasks.process_suspect_commits": settings.SENTRY_SUSPECT_COMMITS_APM_SAMPLING,
    "sentry.tasks.process_commit_context": settings.SENTRY_SUSPECT_COMMITS_APM_SAMPLING,
    "sentry.tasks.post_process.post_process_group": settings.SENTRY_POST_PROCESS_GROUP_APM_SAMPLING,
    "sentry.tasks.reprocessing2.handle_remaining_events": settings.SENTRY_REPROCESSING_APM_SAMPLING,
    "sentry.tasks.reprocessing2.reprocess_group": settings.SENTRY_REPROCESSING_APM_SAMPLING,
    "sentry.tasks.reprocessing2.finish_reprocessing": settings.SENTRY_REPROCESSING_APM_SAMPLING,
    "sentry.tasks.relay.build_project_config": settings.SENTRY_RELAY_TASK_APM_SAMPLING,
    "sentry.tasks.relay.invalidate_project_config": settings.SENTRY_RELAY_TASK_APM_SAMPLING,
    # This is the parent task of the next two tasks.
    "sentry.tasks.reports.prepare_reports": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.reports.prepare_organization_report": 0.1,
    "sentry.tasks.reports.deliver_organization_user_report": 0.01,
    "sentry.tasks.process_buffer.process_incr": 0.01,
    "sentry.replays.tasks.delete_recording_segments": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.weekly_reports.schedule_organizations": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.weekly_reports.prepare_organization_report": 0.1,
    "sentry.profiles.task.process_profile": 0.01,
    "sentry.tasks.derive_code_mappings.process_organizations": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.derive_code_mappings.derive_code_mappings": settings.SAMPLED_DEFAULT_RATE,
}

if settings.ADDITIONAL_SAMPLED_TASKS:
    SAMPLED_TASKS.update(settings.ADDITIONAL_SAMPLED_TASKS)


UNSAFE_TAG = "_unsafe"
EXPERIMENT_TAG = "_experimental_event"


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


def is_current_event_experimental():
    """
    Checks if the event was explicitly marked as experimental.
    """
    with configure_scope() as scope:
        if scope._tags.get(EXPERIMENT_TAG):
            return True
    return False


def mark_scope_as_unsafe():
    """
    Set the unsafe tag on the SDK scope for outgoing crashes and transactions.

    Marking a scope explicitly as unsafe allows the recursion breaker to
    decide early, before walking the stack and checking for unsafe files.
    """
    with configure_scope() as scope:
        scope.set_tag(UNSAFE_TAG, True)


def mark_scope_as_experimental():
    """
    Set the experimental tag on the SDK scope for outgoing crashes and transactions.

    Marking the scope will cause these crashes and transaction to be sent to a separate experimental dsn.
    """
    with configure_scope() as scope:
        scope.set_tag(EXPERIMENT_TAG, True)


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
    from sentry.models.projectkey import ProjectKey

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


def traces_sampler(sampling_context):
    # If there's already a sampling decision, just use that
    if sampling_context["parent_sampled"] is not None:
        return sampling_context["parent_sampled"]

    if "celery_job" in sampling_context:
        task_name = sampling_context["celery_job"].get("task")

        if task_name in SAMPLED_TASKS:
            return SAMPLED_TASKS[task_name]

    # Resolve the url, and see if we want to set our own sampling
    if "wsgi_environ" in sampling_context:
        try:
            match = resolve(sampling_context["wsgi_environ"].get("PATH_INFO"))
            if match and match.url_name in SAMPLED_URL_NAMES:
                return SAMPLED_URL_NAMES[match.url_name]
        except Exception:
            # On errors or 404, continue to default sampling decision
            pass

    # Default to the sampling rate in settings
    return float(settings.SENTRY_BACKEND_APM_SAMPLING or 0)


# Patches transport functions to add metrics to improve resolution around events sent to our ingest.
# Leaving this in to keep a permanent measurement of sdk requests vs ingest.
def patch_transport_for_instrumentation(transport, transport_name):
    _send_request = transport._send_request
    if _send_request:

        def patched_send_request(*args, **kwargs):
            metrics.incr(f"internal.sent_requests.{transport_name}.events")
            return _send_request(*args, **kwargs)

        transport._send_request = patched_send_request
    return transport


def configure_sdk():
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.threading import ThreadingIntegration

    assert sentry_sdk.Hub.main.client is None

    sdk_options = dict(settings.SENTRY_SDK_CONFIG)

    relay_dsn = sdk_options.pop("relay_dsn", None)
    experimental_dsn = sdk_options.pop("experimental_dsn", None)
    internal_project_key = get_project_key()
    # Modify SENTRY_SDK_CONFIG in your deployment scripts to specify your desired DSN
    upstream_dsn = sdk_options.pop("dsn", None)
    sdk_options["traces_sampler"] = traces_sampler
    sdk_options["release"] = (
        f"backend@{sdk_options['release']}" if "release" in sdk_options else None
    )
    sdk_options["send_client_reports"] = True

    if upstream_dsn:
        transport = make_transport(get_options(dsn=upstream_dsn, **sdk_options))
        upstream_transport = patch_transport_for_instrumentation(transport, "upstream")
    else:
        upstream_transport = None

    if relay_dsn:
        transport = make_transport(get_options(dsn=relay_dsn, **sdk_options))
        relay_transport = patch_transport_for_instrumentation(transport, "relay")
    elif settings.IS_DEV and not settings.SENTRY_USE_RELAY:
        relay_transport = None
    elif internal_project_key and internal_project_key.dsn_private:
        transport = make_transport(get_options(dsn=internal_project_key.dsn_private, **sdk_options))
        relay_transport = patch_transport_for_instrumentation(transport, "relay")
    else:
        relay_transport = None

    if experimental_dsn:
        transport = make_transport(get_options(dsn=experimental_dsn, **sdk_options))
        experimental_transport = patch_transport_for_instrumentation(transport, "experimental")
    else:
        experimental_transport = None

    if settings.SENTRY_PROFILING_ENABLED:
        sdk_options.setdefault("_experiments", {}).update(
            {
                "profiles_sample_rate": settings.SENTRY_PROFILES_SAMPLE_RATE,
                "profiler_mode": settings.SENTRY_PROFILER_MODE,
            }
        )

    class MultiplexingTransport(sentry_sdk.transport.Transport):
        def capture_envelope(self, envelope):
            # Temporarily capture envelope counts to compare to ingested
            # transactions.
            metrics.incr("internal.captured.events.envelopes")
            transaction = envelope.get_transaction_event()

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
            # Experimental events will be sent to the experimental transport.
            if experimental_transport:
                rate = options.get("store.use-experimental-dsn-sample-rate")
                if is_current_event_experimental():
                    if rate and random.random() < rate:
                        getattr(experimental_transport, method_name)(*args, **kwargs)
                    # Experimental events should not be sent to other transports even if they are not sampled.
                    return

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
                # If this is a envelope ensure envelope and it's items are distinct references
                if method_name == "capture_envelope":
                    args_list = list(args)
                    envelope = args_list[0]
                    relay_envelope = copy.copy(envelope)
                    relay_envelope.items = envelope.items.copy()
                    args = [relay_envelope, *args_list[1:]]

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
        # set back the upstream_dsn popped above since we need a default dsn on the client
        # for dynamic sampling context public_key population
        dsn=upstream_dsn,
        transport=MultiplexingTransport(),
        integrations=[
            DjangoAtomicIntegration(),
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(event_level=None),
            RustInfoIntegration(),
            RedisIntegration(),
            ThreadingIntegration(propagate_hub=True),
        ],
        **sdk_options,
    )

    if settings.SENTRY_PROFILING_ENABLED:
        sentry_sdk.set_tag("sentry.profiler", settings.SENTRY_PROFILER_MODE)


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


def set_measurement(measurement_name, value, unit=None):
    try:
        transaction = sentry_sdk.Hub.current.scope.transaction
        if transaction is not None:
            transaction.set_measurement(measurement_name, value, unit)
    except Exception:
        pass
