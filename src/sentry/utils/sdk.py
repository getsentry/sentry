from __future__ import absolute_import, print_function

import inspect
import json
import logging
import six
import zlib

from django.conf import settings
from django.utils.functional import cached_property

import sentry_sdk

from sentry_sdk.client import get_options
from sentry_sdk.transport import Transport, make_transport
from sentry_sdk.consts import VERSION as SDK_VERSION
from sentry_sdk.utils import Auth, capture_internal_exceptions
from sentry_sdk.utils import logger as sdk_logger

from sentry import options
from sentry.utils import metrics
from sentry.utils.rust import RustInfoIntegration

UNSAFE_FILES = ("sentry/event_manager.py", "sentry/tasks/process_buffer.py")

# Reexport sentry_sdk just in case we ever have to write another shim like we
# did for raven
from sentry_sdk import configure_scope, push_scope, capture_message, capture_exception  # NOQA


def is_current_event_safe():
    """
    Tests the current stack for unsafe locations that would likely cause
    recursion if an attempt to send to Sentry was made.
    """
    for _, filename, _, _, _, _ in inspect.stack():
        if filename.endswith(UNSAFE_FILES):
            return False
    return True


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
        sdk_logger.warn(
            "internal-error.unable-to-fetch-project",
            extra={
                "project_id": settings.SENTRY_PROJECT,
                "project_key": settings.SENTRY_PROJECT_KEY,
                "error_message": six.text_type(exc),
            },
        )
    if key is None:
        sdk_logger.warn(
            "internal-error.no-project-available",
            extra={
                "project_id": settings.SENTRY_PROJECT,
                "project_key": settings.SENTRY_PROJECT_KEY,
            },
        )
    return key


class SentryInternalFilter(logging.Filter):
    def filter(self, record):
        # TODO(mattrobenolt): handle an upstream Sentry
        metrics.incr("internal.uncaptured.logs", skip_internal=False)
        return is_current_event_safe()


def configure_sdk():
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration

    assert sentry_sdk.Hub.main.client is None

    sdk_options = settings.SENTRY_SDK_CONFIG

    internal_transport = InternalTransport()
    upstream_transport = None
    if sdk_options.get("dsn"):
        upstream_transport = make_transport(get_options(sdk_options))

    def capture_event(event):
        if event.get("type") == "transaction" and options.get(
            "transaction-events.force-disable-internal-project"
        ):
            return

        # Make sure we log to upstream when available first
        if upstream_transport is not None:
            # TODO(mattrobenolt): Bring this back safely.
            # from sentry import options
            # install_id = options.get('sentry:install-id')
            # if install_id:
            #     event.setdefault('tags', {})['install-id'] = install_id
            upstream_transport.capture_event(event)

        internal_transport.capture_event(event)

    sentry_sdk.init(
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(event_level=None),
            RustInfoIntegration(),
        ],
        transport=capture_event,
        traceparent_v2=True,
        **sdk_options
    )


def _create_noop_hub():
    def transport(event):
        with capture_internal_exceptions():
            metrics.incr("internal.uncaptured.events", skip_internal=False)
            sdk_logger.warn("internal-error.noop-hub")

    return sentry_sdk.Hub(sentry_sdk.Client(transport=transport))


NOOP_HUB = _create_noop_hub()
del _create_noop_hub


class InternalTransport(Transport):
    def __init__(self):
        pass

    @cached_property
    def project_key(self):
        return get_project_key()

    @cached_property
    def request_factory(self):
        from django.test import RequestFactory

        return RequestFactory()

    def capture_event(self, event):
        # Disable the SDK while processing our own events. This fixes some
        # recursion issues when the view crashes without including any
        # UNSAFE_FILES
        #
        # NOTE: UNSAFE_FILES still exists because the hub does not follow the
        # execution flow into the celery job triggered by StoreView. In other
        # words, UNSAFE_FILES is used in case the celery job for crashes and
        # that error is captured by the SDK.
        with NOOP_HUB:
            return self._capture_event(event)

    def _capture_event(self, event):
        with capture_internal_exceptions():
            key = self.project_key
            if key is None:
                return

            if not is_current_event_safe():
                metrics.incr("internal.uncaptured.events", skip_internal=False)
                sdk_logger.warn("internal-error.unsafe-stacktrace")
                return

            auth = Auth(
                scheme="https",
                host="localhost",
                project_id=key.project_id,
                public_key=key.public_key,
                secret_key=key.secret_key,
                client="sentry-python/%s" % SDK_VERSION,
            )

            headers = {"HTTP_X_SENTRY_AUTH": auth.to_header(), "HTTP_CONTENT_ENCODING": "deflate"}

            request = self.request_factory.post(
                "/api/{}/store/".format(key.project_id),
                data=zlib.compress(json.dumps(event).encode("utf8")),
                content_type="application/octet-stream",
                **headers
            )

            from sentry.web.api import StoreView

            resp = StoreView.as_view()(request, project_id=six.text_type(key.project_id))

            if resp.status_code != 200:
                sdk_logger.warn(
                    "internal-error.invalid-response",
                    extra={
                        "project_id": settings.SENTRY_PROJECT,
                        "project_key": settings.SENTRY_PROJECT_KEY,
                        "status_code": resp.status_code,
                    },
                )


class RavenShim(object):
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
