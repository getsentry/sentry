from __future__ import annotations

import copy
import inspect
import logging
import random
from typing import TYPE_CHECKING, Any, Mapping

import sentry_sdk
from django.conf import settings
from django.urls import resolve
from rest_framework.request import Request

# Reexport sentry_sdk just in case we ever have to write another shim like we
# did for raven
from sentry_sdk import push_scope  # NOQA
from sentry_sdk import Scope, capture_exception, capture_message, configure_scope
from sentry_sdk.client import get_options
from sentry_sdk.integrations.django.transactions import LEGACY_RESOLVER
from sentry_sdk.transport import make_transport
from sentry_sdk.utils import logger as sdk_logger

from sentry import options
from sentry.utils import metrics
from sentry.utils.db import DjangoAtomicIntegration
from sentry.utils.rust import RustInfoIntegration

# Can't import models in utils because utils should be the bottom of the food chain
if TYPE_CHECKING:
    from sentry.models.organization import Organization

logger = logging.getLogger(__name__)

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
    "sentry-api-0-sentry-app-installation-authorizations": settings.SAMPLED_DEFAULT_RATE,
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
# If a parent task schedules other tasks you should add it in here or the child
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
    "sentry.ingest.transaction_clusterer.tasks.spawn_clusterers": settings.SENTRY_RELAY_TASK_APM_SAMPLING,
    "sentry.ingest.transaction_clusterer.tasks.cluster_projects": settings.SENTRY_RELAY_TASK_APM_SAMPLING,
    "sentry.tasks.process_buffer.process_incr": 0.01,
    "sentry.replays.tasks.delete_recording_segments": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.weekly_reports.schedule_organizations": 1.0,
    "sentry.tasks.weekly_reports.prepare_organization_report": 0.1,
    "sentry.profiles.task.process_profile": 0.01,
    "sentry.tasks.derive_code_mappings.process_organizations": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.derive_code_mappings.derive_code_mappings": settings.SAMPLED_DEFAULT_RATE,
    "sentry.monitors.tasks.check_monitors": 1.0,
    "sentry.tasks.auto_enable_codecov": settings.SAMPLED_DEFAULT_RATE,
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


def before_send_transaction(event, _):
    # Occasionally the span limit is hit and we drop spans from transactions, this helps find transactions where this occurs.
    num_of_spans = len(event["spans"])
    event["tags"]["spans_over_limit"] = num_of_spans >= 1000
    if not event["measurements"]:
        event["measurements"] = {}
    event["measurements"]["num_of_spans"] = {"value": num_of_spans}
    return event


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
    sdk_options["before_send_transaction"] = before_send_transaction

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
        sdk_options["profiles_sample_rate"] = settings.SENTRY_PROFILES_SAMPLE_RATE
        sdk_options["profiler_mode"] = settings.SENTRY_PROFILER_MODE

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
            DjangoIntegration(signals_spans=False),
            CeleryIntegration(monitor_beat_tasks=True),
            # This makes it so all levels of logging are recorded as breadcrumbs,
            # but none are captured as events (that's handled by the `internal`
            # logger defined in `server.py`, which ignores the levels set
            # in the integration and goes straight to the underlying handler class).
            LoggingIntegration(event_level=None),
            RustInfoIntegration(),
            RedisIntegration(),
            ThreadingIntegration(propagate_hub=True),
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


def check_tag(tag_key: str, expected_value: str) -> None:
    """Detect a tag already set and being different than what we expect.

    This function checks if a tag has been already been set and if it differs
    from what we want to set it to.
    """
    with configure_scope() as scope:
        current_value = scope._tags.get(tag_key)

        if not current_value:
            return

        # There are times where we can only narrow down the current org to a list, for example if
        # we've derived it from an integration, since integrations can be shared across multiple orgs.
        if tag_key == "organization.slug" and current_value == "[multiple orgs]":
            # Currently, we don't have access in this function to the underlying slug list
            # corresponding to an incoming "[multiple orgs]" tag, so we can't check it against the
            # current list. Regardless of whether the lists would match, it's currently not flagged
            # as scope bleed. (Fortunately, that version of scope bleed should be a pretty rare case,
            # since only ~3% of integrations belong to multiple orgs, making the chance of it
            # happening twice around 0.1%.) So for now, just skip that case.
            if expected_value != "[multiple orgs]":
                # If we've now figured out which of that list is correct, don't count it as a mismatch.
                # But if it currently is a list and `expected_value` is something *not* in that list,
                # we're almost certainly dealing with scope bleed, so we should continue with our check.
                current_org_list = scope._contexts.get("organization", {}).get(
                    "multiple possible", []
                )
                if current_org_list and expected_value in current_org_list:
                    return

        if current_value != expected_value:
            scope.set_tag("possible_mistag", True)
            scope.set_tag(f"scope_bleed.{tag_key}", True)
            extra = {
                f"previous_{tag_key}_tag": current_value,
                f"new_{tag_key}_tag": expected_value,
            }
            merge_context_into_scope("scope_bleed", extra, scope)
            logger.warning(f"Tag already set and different ({tag_key}).", extra=extra)


def get_transaction_name_from_request(request: Request) -> str:
    """
    Given an incoming request, derive a parameterized transaction name, if possible. Based on the
    implementation in `_set_transaction_name_and_source` in the SDK, which is what it uses to label
    request transactions. See https://github.com/getsentry/sentry-python/blob/6c68cf4742e6f65da431210085ee095ba6535cee/sentry_sdk/integrations/django/__init__.py#L333.

    If parameterization isn't possible, use the request's path.
    """

    transaction_name = request.path_info
    try:
        # Note: In spite of the name, the legacy resolver is still what's used in the python SDK
        transaction_name = LEGACY_RESOLVER.resolve(
            request.path_info, urlconf=getattr(request, "urlconf", None)
        )
    except Exception:
        pass

    return transaction_name


def check_current_scope_transaction(
    request: Request,
) -> dict[str, str] | None:
    """
    Check whether the name of the transaction on the current scope matches what we'd expect, given
    the request being handled.

    If the transaction values match, return None. If they don't, return a dictionary including both
    values.

    Note: Ignores scope `transaction` values with `source = "custom"`, indicating a value which has
    been set maunually. (See the `transaction_start` decorator, for example.)
    """

    with configure_scope() as scope:
        transaction_from_request = get_transaction_name_from_request(request)

        if (
            scope._transaction != transaction_from_request
            and scope._transaction_info.get("source") != "custom"
        ):
            return {
                "scope_transaction": scope._transaction,
                "request_transaction": transaction_from_request,
            }


def capture_exception_with_scope_check(
    error, scope: Scope | None = None, request: Request | None = None, **scope_args
):
    """
    A wrapper around `sentry_sdk.capture_exception` which checks scope `transaction` against the
    given Request object, to help debug scope bleed problems.
    """

    # The SDK's version of `capture_exception` accepts either a `Scope` object or scope kwargs.
    # Regardless of which one the caller passed, convert the data into a `Scope` object
    extra_scope = scope or Scope()
    extra_scope.update_from_kwargs(**scope_args)

    # We've got a weird scope bleed problem, where, among other things, errors are getting tagged
    # with the wrong transaction value, so record any possible mismatch.
    transaction_mismatch = check_current_scope_transaction(request) if request else None
    if transaction_mismatch:
        # TODO: We probably should add this data to the scope in `check_current_scope_transaction`
        # instead, but the whole point is that right now it's unclear how trustworthy ambient scope is
        extra_scope.set_tag("scope_bleed.transaction", True)
        merge_context_into_scope("scope_bleed", transaction_mismatch, extra_scope)

    return sentry_sdk.capture_exception(error, scope=extra_scope)


def bind_organization_context(organization):
    # Callable to bind additional context for the Sentry SDK
    helper = settings.SENTRY_ORGANIZATION_CONTEXT_HELPER

    # XXX(dcramer): this is duplicated in organizationContext.jsx on the frontend
    with configure_scope() as scope, sentry_sdk.start_span(
        op="other", description="bind_organization_context"
    ):
        # This can be used to find errors that may have been mistagged
        check_tag("organization.slug", organization.slug)

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


def bind_ambiguous_org_context(orgs: list[Organization], source: str | None = None) -> None:
    """
    Add org context information to the scope in the case where the current org might be one of a
    number of known orgs (for example, if we've attempted to derive the current org from an
    Integration instance, which can be shared by multiple orgs).
    """

    MULTIPLE_ORGS_TAG = "[multiple orgs]"

    org_slugs = [org.slug for org in orgs]

    # Right now there is exactly one Integration instance shared by more than 30 orgs (the generic
    # GitLab integration, at the moment shared by ~500 orgs), so 50 should be plenty for all but
    # that one instance
    if len(orgs) > 50:
        org_slugs = org_slugs[:49] + [f"... ({len(orgs) - 49} more)"]

    with configure_scope() as scope:
        # It's possible we've already set the org context with one of the orgs in our list,
        # somewhere we could narrow it down to one org. In that case, we don't want to overwrite
        # that specific data with this ambiguous data.
        current_org_slug_tag = scope._tags.get("organization.slug")
        if current_org_slug_tag and current_org_slug_tag in org_slugs:
            return

        # It's also possible that the org seems already to be set but it's just a case of scope
        # bleed. In that case, we want to test for that and proceed.
        check_tag("organization.slug", MULTIPLE_ORGS_TAG)

        scope.set_tag("organization", MULTIPLE_ORGS_TAG)
        scope.set_tag("organization.slug", MULTIPLE_ORGS_TAG)

        scope.set_context(
            "organization", {"multiple possible": org_slugs, "source": source or "unknown"}
        )


def set_measurement(measurement_name, value, unit=None):
    try:
        transaction = sentry_sdk.Hub.current.scope.transaction
        if transaction is not None:
            transaction.set_measurement(measurement_name, value, unit)
    except Exception:
        pass


def merge_context_into_scope(
    context_name: str, context_data: Mapping[str, Any], scope: Scope
) -> None:
    """
    Add the given context to the given scope, merging the data in if a context with the given name
    already exists.
    """

    existing_context = scope._contexts.setdefault(context_name, {})
    existing_context.update(context_data)
