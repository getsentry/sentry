from __future__ import annotations

import copy
import logging
import sys
from collections.abc import Generator, Mapping, Sequence
from types import FrameType
from typing import TYPE_CHECKING, Any, NamedTuple

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request

# Reexport sentry_sdk just in case we ever have to write another shim like we
# did for raven
from sentry_sdk import Scope, capture_exception, capture_message, isolation_scope
from sentry_sdk.client import get_options
from sentry_sdk.integrations.django.transactions import LEGACY_RESOLVER
from sentry_sdk.transport import make_transport
from sentry_sdk.types import Event, Hint
from sentry_sdk.utils import logger as sdk_logger

from sentry import options
from sentry.conf.types.sdk_config import SdkConfig
from sentry.features.rollout import in_random_rollout
from sentry.utils import metrics
from sentry.utils.db import DjangoAtomicIntegration
from sentry.utils.flag import FlagPoleIntegration
from sentry.utils.rust import RustInfoIntegration

# Can't import models in utils because utils should be the bottom of the food chain
if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.organizations.services.organization import RpcOrganization


logger = logging.getLogger(__name__)

UNSAFE_FILES = (
    "sentry/event_manager.py",
    "sentry/spans/consumers/process/factory.py",
    "sentry/spans/consumers/detect_performance_issues/factory.py",
    "sentry/tasks/process_buffer.py",
    "sentry/ingest/consumer/processors.py",
    # This consumer lives outside of sentry but is just as unsafe.
    "outcomes_consumer.py",
)

# Tasks not included here are sampled with `SENTRY_BACKEND_APM_SAMPLING`.
# If a parent task schedules other tasks, rates propagate to the children.
SAMPLED_TASKS = {
    "sentry.tasks.auto_source_code_configs.derive_code_mappings": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.send_ping": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.store.process_event": settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
    "sentry.tasks.store.process_event_from_reprocessing": settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
    "sentry.tasks.store.save_event": 0.1 * settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
    "sentry.tasks.store.save_event_transaction": 0.1 * settings.SENTRY_PROCESS_EVENT_APM_SAMPLING,
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
    "sentry.tasks.process_buffer.process_incr": 0.1 * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.replays.tasks.delete_recording_segments": settings.SAMPLED_DEFAULT_RATE,
    "sentry.replays.tasks.delete_replay_recording_async": settings.SAMPLED_DEFAULT_RATE,
    "sentry.tasks.summaries.weekly_reports.schedule_organizations": 1.0,
    "sentry.tasks.summaries.weekly_reports.prepare_organization_report": 0.1
    * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.profiles.task.process_profile": 0.1 * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.monitors.tasks.clock_pulse": 1.0,
    "sentry.tasks.auto_enable_codecov": settings.SAMPLED_DEFAULT_RATE,
    "sentry.dynamic_sampling.tasks.boost_low_volume_projects": 1.0,
    "sentry.dynamic_sampling.tasks.boost_low_volume_transactions": 1.0,
    "sentry.dynamic_sampling.tasks.recalibrate_orgs": 0.2 * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.dynamic_sampling.tasks.sliding_window_org": 0.2 * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.dynamic_sampling.tasks.custom_rule_notifications": 0.2
    * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.dynamic_sampling.tasks.clean_custom_rule_notifications": 0.2
    * settings.SENTRY_BACKEND_APM_SAMPLING,
    "sentry.tasks.embeddings_grouping.backfill_seer_grouping_records_for_project": 1.0,
}

if settings.ADDITIONAL_SAMPLED_TASKS:
    SAMPLED_TASKS.update(settings.ADDITIONAL_SAMPLED_TASKS)


UNSAFE_TAG = "_unsafe"


def _current_stack_filenames() -> Generator[str]:
    f: FrameType | None = sys._getframe()
    while f is not None:
        yield f.f_code.co_filename
        f = f.f_back


def is_current_event_safe():
    """
    Tests the current stack for unsafe locations that would likely cause
    recursion if an attempt to send to Sentry was made.
    """
    scope = Scope.get_isolation_scope()

    # Scope was explicitly marked as unsafe
    if scope._tags.get(UNSAFE_TAG):
        return False

    project_id = scope._tags.get("processing_event_for_project")

    if project_id and project_id == settings.SENTRY_PROJECT:
        return False

    for filename in _current_stack_filenames():
        if filename.endswith(UNSAFE_FILES):
            return False

    return True


def set_current_event_project(project_id):
    """
    Set the current project on the SDK isolation scope for outgoing crash reports.

    This is a dedicated function because it is also important for the recursion
    breaker to work. You really should set the project in every task that is
    relevant to event processing, or that task may crash ingesting
    sentry-internal errors, causing infinite recursion.
    """
    scope = Scope.get_isolation_scope()

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
    # dont sample warmup requests
    if sampling_context.get("wsgi_environ", {}).get("PATH_INFO") == "/_warmup/":
        return 0.0

    # Apply sample_rate from custom_sampling_context
    custom_sample_rate = sampling_context.get("sample_rate")
    if custom_sample_rate is not None:
        return float(custom_sample_rate)

    # If there's already a sampling decision, just use that
    if sampling_context["parent_sampled"] is not None:
        return sampling_context["parent_sampled"]

    if "celery_job" in sampling_context:
        task_name = sampling_context["celery_job"].get("task")

        if task_name in SAMPLED_TASKS:
            return SAMPLED_TASKS[task_name]

    # Default to the sampling rate in settings
    return float(settings.SENTRY_BACKEND_APM_SAMPLING or 0)


def profiles_sampler(sampling_context):
    PROFILES_SAMPLING_RATE = {
        "spans.process.process_message": options.get(
            "standalone-spans.profile-process-messages.rate"
        )
    }
    if "transaction_context" in sampling_context:
        transaction_name = sampling_context["transaction_context"].get("name")

        if transaction_name in PROFILES_SAMPLING_RATE:
            return PROFILES_SAMPLING_RATE[transaction_name]

    # Default to the sampling rate in settings
    return float(settings.SENTRY_PROFILES_SAMPLE_RATE or 0)


def before_send_transaction(event: Event, _: Hint) -> Event | None:
    # Discard generic redirects.
    # This condition can be removed once https://github.com/getsentry/team-sdks/issues/48 is fixed.
    if (
        event.get("tags", {}).get("http.status_code") == "301"
        and event.get("transaction_info", {}).get("source") == "url"
    ):
        return None

    # Occasionally the span limit is hit and we drop spans from transactions, this helps find transactions where this occurs.
    num_of_spans = len(event["spans"])
    event["tags"]["spans_over_limit"] = str(num_of_spans >= 1000)
    if not event["measurements"]:
        event["measurements"] = {}
    event["measurements"]["num_of_spans"] = {
        "value": num_of_spans,
        "unit": None,
    }
    return event


def before_send(event: Event, _: Hint) -> Event | None:
    if event.get("tags"):
        if settings.SILO_MODE:
            event["tags"]["silo_mode"] = str(settings.SILO_MODE)
        if settings.SENTRY_REGION:
            event["tags"]["sentry_region"] = settings.SENTRY_REGION
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


class Dsns(NamedTuple):
    sentry4sentry: str | None
    sentry_saas: str | None


def _get_sdk_options() -> tuple[SdkConfig, Dsns]:
    sdk_options = settings.SENTRY_SDK_CONFIG.copy()
    sdk_options["send_client_reports"] = True
    sdk_options["traces_sampler"] = traces_sampler
    sdk_options["before_send_transaction"] = before_send_transaction
    sdk_options["before_send"] = before_send
    sdk_options["release"] = (
        f"backend@{sdk_options['release']}" if "release" in sdk_options else None
    )
    sdk_options.setdefault("_experiments", {}).update(
        transport_http2=True,
    )

    # Modify SENTRY_SDK_CONFIG in your deployment scripts to specify your desired DSN
    dsns = Dsns(
        sentry4sentry=sdk_options.pop("dsn", None),
        sentry_saas=sdk_options.pop("relay_dsn", None),
    )

    return sdk_options, dsns


def configure_sdk():
    """
    Setup and initialize the Sentry SDK.
    """
    sdk_options, dsns = _get_sdk_options()

    internal_project_key = get_project_key()

    if dsns.sentry4sentry:
        transport = make_transport(get_options(dsn=dsns.sentry4sentry, **sdk_options))
        sentry4sentry_transport = patch_transport_for_instrumentation(transport, "upstream")
    else:
        sentry4sentry_transport = None

    if dsns.sentry_saas:
        transport = make_transport(get_options(dsn=dsns.sentry_saas, **sdk_options))
        sentry_saas_transport = patch_transport_for_instrumentation(transport, "relay")
    elif settings.IS_DEV and not settings.SENTRY_USE_RELAY:
        sentry_saas_transport = None
    elif internal_project_key and internal_project_key.dsn_private:
        transport = make_transport(get_options(dsn=internal_project_key.dsn_private, **sdk_options))
        sentry_saas_transport = patch_transport_for_instrumentation(transport, "relay")
    else:
        sentry_saas_transport = None

    if settings.SENTRY_CONTINUOUS_PROFILING_ENABLED:
        sdk_options.setdefault("_experiments", {}).update(
            continuous_profiling_auto_start=True,
        )
    elif settings.SENTRY_PROFILING_ENABLED:
        sdk_options["profiles_sampler"] = profiles_sampler
        sdk_options["profiler_mode"] = settings.SENTRY_PROFILER_MODE

    class MultiplexingTransport(sentry_sdk.transport.Transport):
        """
        Sends all envelopes and events to two Sentry instances:
        - Sentry SaaS (aka Sentry.io) and
        - Sentry4Sentry (aka S4S)
        """

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
            # Sentry4Sentry (upstream) should get the event first because
            # it is most isolated from the sentry installation.
            if sentry4sentry_transport:
                metrics.incr("internal.captured.events.upstream")
                # TODO(mattrobenolt): Bring this back safely.
                # from sentry import options
                # install_id = options.get('sentry:install-id')
                # if install_id:
                #     event.setdefault('tags', {})['install-id'] = install_id
                s4s_args = args
                # We want to control whether we want to send metrics at the s4s upstream.
                if (
                    not settings.SENTRY_SDK_UPSTREAM_METRICS_ENABLED
                    and method_name == "capture_envelope"
                ):
                    args_list = list(args)
                    envelope = args_list[0]
                    # We filter out all the statsd envelope items, which contain custom metrics sent by the SDK.
                    # unless we allow them via a separate sample rate.
                    safe_items = [
                        x
                        for x in envelope.items
                        if x.data_category != "statsd"
                        or in_random_rollout("store.allow-s4s-ddm-sample-rate")
                    ]
                    if len(safe_items) != len(envelope.items):
                        relay_envelope = copy.copy(envelope)
                        relay_envelope.items = safe_items
                        s4s_args = (relay_envelope, *args_list[1:])

                getattr(sentry4sentry_transport, method_name)(*s4s_args, **kwargs)

            if sentry_saas_transport and options.get("store.use-relay-dsn-sample-rate") == 1:
                # If this is an envelope ensure envelope and its items are distinct references
                if method_name == "capture_envelope":
                    args_list = list(args)
                    envelope = args_list[0]
                    relay_envelope = copy.copy(envelope)
                    relay_envelope.items = envelope.items.copy()
                    args = (relay_envelope, *args_list[1:])

                if sentry_saas_transport:
                    if is_current_event_safe():
                        metrics.incr("internal.captured.events.relay")
                        getattr(sentry_saas_transport, method_name)(*args, **kwargs)
                    else:
                        metrics.incr(
                            "internal.uncaptured.events.relay",
                            skip_internal=False,
                            tags={"reason": "unsafe"},
                        )

        def record_lost_event(self, *args, **kwargs):
            # pass through client report recording to sentry_saas_transport
            # not entirely accurate for some cases like rate limiting but does the job
            if sentry_saas_transport:
                record = getattr(sentry_saas_transport, "record_lost_event", None)
                if record:
                    record(*args, **kwargs)

        def is_healthy(self):
            if sentry4sentry_transport:
                if not sentry4sentry_transport.is_healthy():
                    return False
            if sentry_saas_transport:
                if not sentry_saas_transport.is_healthy():
                    return False
            return True

        def flush(
            self,
            timeout,
            callback=None,
        ):
            # flush transports in case we received a kill signal
            if sentry4sentry_transport:
                getattr(sentry4sentry_transport, "flush")(timeout, callback)
            if sentry_saas_transport:
                getattr(sentry_saas_transport, "flush")(timeout, callback)

    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.threading import ThreadingIntegration

    # exclude monitors with sub-minute schedules from using crons
    exclude_beat_tasks = [
        "deliver-from-outbox-control",
        "deliver-webhooks-control",
        "flush-buffers",
        "sync-options",
        "sync-options-control",
        "schedule-digests",
    ]

    sentry_sdk.init(
        # set back the sentry4sentry_dsn popped above since we need a default dsn on the client
        # for dynamic sampling context public_key population
        dsn=dsns.sentry4sentry,
        transport=MultiplexingTransport(),
        integrations=[
            DjangoAtomicIntegration(),
            DjangoIntegration(signals_spans=False, cache_spans=True),
            CeleryIntegration(monitor_beat_tasks=True, exclude_beat_tasks=exclude_beat_tasks),
            # This makes it so all levels of logging are recorded as breadcrumbs,
            # but none are captured as events (that's handled by the `internal`
            # logger defined in `server.py`, which ignores the levels set
            # in the integration and goes straight to the underlying handler class).
            LoggingIntegration(event_level=None),
            RustInfoIntegration(),
            RedisIntegration(),
            ThreadingIntegration(propagate_hub=True),
            FlagPoleIntegration(),
        ],
        **sdk_options,
    )


def check_tag_for_scope_bleed(
    tag_key: str, expected_value: str | int, add_to_scope: bool = True
) -> None:
    """
    Detect if the given tag has already been set to a value different than what we expect. If we
    find a mismatch, log a warning and, if `add_to_scope` is `True`, add scope bleed tags to the
    scope. (An example of when we don't want to add scope bleed tag is if we're only logging a
    warning rather than capturing an event.)
    """
    # force the string version to prevent false positives
    expected_value = str(expected_value)

    scope = Scope.get_isolation_scope()

    current_value = scope._tags.get(tag_key)

    if not current_value:
        return

    # ensure we're comparing apples to apples
    current_value = str(current_value)

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
            current_org_list = scope._contexts.get("organization", {}).get("multiple possible", [])
            if current_org_list and expected_value in current_org_list:
                return

    if current_value != expected_value:
        extra = {
            f"previous_{tag_key}_tag": current_value,
            f"new_{tag_key}_tag": expected_value,
        }
        if add_to_scope:
            scope.set_tag("possible_mistag", True)
            scope.set_tag(f"scope_bleed.{tag_key}", True)
            merge_context_into_scope("scope_bleed", extra, scope)
        logger.warning("Tag already set and different (%s).", tag_key, extra=extra)


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
        resolved_transaction_name = LEGACY_RESOLVER.resolve(
            request.path_info, urlconf=getattr(request, "urlconf", None)
        )
    except Exception:
        pass
    else:
        if resolved_transaction_name is not None:
            transaction_name = resolved_transaction_name

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
    been set maunually.
    """
    scope = sentry_sdk.Scope.get_current_scope()
    transaction_from_request = get_transaction_name_from_request(request)

    if (
        scope._transaction is not None
        and scope._transaction != transaction_from_request
        and scope._transaction_info.get("source") != "custom"
    ):
        return {
            "scope_transaction": scope._transaction,
            "request_transaction": transaction_from_request,
        }
    else:
        return None


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


def bind_organization_context(organization: Organization | RpcOrganization) -> None:
    # Callable to bind additional context for the Sentry SDK
    helper = settings.SENTRY_ORGANIZATION_CONTEXT_HELPER

    scope = Scope.get_isolation_scope()

    # XXX(dcramer): this is duplicated in organizationContext.jsx on the frontend
    with sentry_sdk.start_span(op="other", name="bind_organization_context"):
        # This can be used to find errors that may have been mistagged
        check_tag_for_scope_bleed("organization.slug", organization.slug)

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


def bind_ambiguous_org_context(
    orgs: Sequence[Organization] | Sequence[RpcOrganization] | list[str], source: str | None = None
) -> None:
    """
    Add org context information to the scope in the case where the current org might be one of a
    number of known orgs (for example, if we've attempted to derive the current org from an
    Integration instance, which can be shared by multiple orgs).
    """

    MULTIPLE_ORGS_TAG = "[multiple orgs]"

    def parse_org_slug(x: Organization | RpcOrganization | str) -> str:
        if isinstance(x, str):
            return x
        return x.slug

    org_slugs = [parse_org_slug(org) for org in orgs]

    # Right now there is exactly one Integration instance shared by more than 30 orgs (the generic
    # GitLab integration, at the moment shared by ~500 orgs), so 50 should be plenty for all but
    # that one instance
    if len(orgs) > 50:
        org_slugs = org_slugs[:49] + [f"... ({len(orgs) - 49} more)"]

    scope = Scope.get_isolation_scope()

    # It's possible we've already set the org context with one of the orgs in our list,
    # somewhere we could narrow it down to one org. In that case, we don't want to overwrite
    # that specific data with this ambiguous data.
    current_org_slug_tag = scope._tags.get("organization.slug")
    if current_org_slug_tag and current_org_slug_tag in org_slugs:
        return

    # It's also possible that the org seems already to be set but it's just a case of scope
    # bleed. In that case, we want to test for that and proceed.
    check_tag_for_scope_bleed("organization.slug", MULTIPLE_ORGS_TAG)

    scope.set_tag("organization", MULTIPLE_ORGS_TAG)
    scope.set_tag("organization.slug", MULTIPLE_ORGS_TAG)

    scope.set_context(
        "organization", {"multiple possible": org_slugs, "source": source or "unknown"}
    )


def set_measurement(measurement_name, value, unit=None):
    try:
        transaction = sentry_sdk.Scope.get_current_scope().transaction
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


__all__ = (
    "LEGACY_RESOLVER",
    "Scope",
    "UNSAFE_FILES",
    "UNSAFE_TAG",
    "before_send_transaction",
    "bind_ambiguous_org_context",
    "bind_organization_context",
    "capture_exception",
    "capture_exception_with_scope_check",
    "capture_message",
    "check_current_scope_transaction",
    "check_tag_for_scope_bleed",
    "configure_sdk",
    "get_options",
    "get_project_key",
    "get_transaction_name_from_request",
    "is_current_event_safe",
    "isolation_scope",
    "make_transport",
    "merge_context_into_scope",
    "patch_transport_for_instrumentation",
    "isolation_scope",
    "set_current_event_project",
    "set_measurement",
    "traces_sampler",
)
