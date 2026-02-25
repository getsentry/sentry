from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Annotated, Any, TypedDict
from urllib.parse import urlencode, urlparse, urlunparse
from uuid import uuid4

from django.utils.functional import cached_property
from requests import RequestException

from sentry.http import safe_urlread
from sentry.sentry_apps.external_requests.utils import send_and_save_sentry_app_request, validate
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppExternalRequestFailureReason,
    SentryAppExternalRequestHaltReason,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.utils import json

FAILURE_REASON_BASE = f"{SentryAppEventType.SELECT_OPTIONS_REQUESTED}.{{}}"


class SelectRequesterResult(TypedDict, total=False):
    # Each contained Sequence of strings is of length 2 i.e ["label", "value"]
    choices: Sequence[Annotated[Sequence[str], 2]]
    defaultValue: str


@dataclass
class SelectRequester:
    """
    1. Makes a GET request to another service to fetch data needed to populate
    the SelectField dropdown in the UI.

    `installationId` and `project` are included in the params of the request

    2. Validates and formats the response.
    """

    install: RpcSentryAppInstallation
    uri: str
    project_slug: str | None = field(default=None)
    query: str | None = field(default=None)
    dependent_data: str | None = field(default=None)

    def run(self) -> SelectRequesterResult:
        response: list[dict[str, str]] = []
        url = None

        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.EXTERNAL_REQUEST,
            event_type=SentryAppEventType.SELECT_OPTIONS_REQUESTED,
        ).capture() as lifecycle:
            extras: dict[str, Any] = {
                "sentry_app_slug": self.sentry_app.slug,
                "install_uuid": self.install.uuid,
                "project_slug": self.project_slug,
            }
            lifecycle.add_extras(extras)

            try:
                url = self._build_url()
                extras.update({"url": url})

                body = safe_urlread(
                    send_and_save_sentry_app_request(
                        url,
                        self.sentry_app,
                        self.install.organization_id,
                        SentryAppEventType.SELECT_OPTIONS_REQUESTED,
                        headers=self._build_headers(),
                    )
                )

                response = json.loads(body)
                extras.update({"response": response})
            except RequestException as e:
                halt_reason = FAILURE_REASON_BASE.format(
                    SentryAppExternalRequestHaltReason.BAD_RESPONSE
                )
                lifecycle.record_halt(halt_reason=e, extra={"reason": halt_reason, **extras})

                raise SentryAppIntegratorError(
                    message=f"Something went wrong while getting options for Select FormField from {self.sentry_app.slug}",
                    webhook_context={"error_type": halt_reason, **extras},
                    status_code=500,
                ) from e

            except Exception as e:
                failure_reason = FAILURE_REASON_BASE.format(
                    SentryAppExternalRequestFailureReason.UNEXPECTED_ERROR
                )

                if not url:
                    failure_reason = FAILURE_REASON_BASE.format(
                        SentryAppExternalRequestFailureReason.MISSING_URL
                    )
                    extras.update(
                        {
                            "uri": self.uri,
                            "dependent_data": self.dependent_data,
                            "webhook_url": self.sentry_app.webhook_url,
                        }
                    )

                raise SentryAppSentryError(
                    message="Something went wrong while preparing to get Select FormField options",
                    webhook_context={"error_type": failure_reason, **extras},
                ) from e

            if not self._validate_response(response):
                halt_reason = FAILURE_REASON_BASE.format(
                    SentryAppExternalRequestHaltReason.MISSING_FIELDS
                )
                lifecycle.record_halt(halt_reason=halt_reason, extra=extras)

                raise SentryAppIntegratorError(
                    message=f"Invalid response format for Select FormField in {self.sentry_app.slug} from uri: {self.uri}",
                    webhook_context={
                        "error_type": halt_reason,
                        **extras,
                    },
                )

            try:
                return self._format_response(response)
            except SentryAppIntegratorError as e:
                lifecycle.record_halt(halt_reason=e, extra={**extras})
                raise

    def _build_url(self) -> str:
        urlparts: list[str] = [url_part for url_part in urlparse(self.sentry_app.webhook_url)]
        urlparts[2] = self.uri

        query = {"installationId": self.install.uuid}

        if self.project_slug:
            query["projectSlug"] = self.project_slug

        if self.query:
            query["query"] = self.query

        if self.dependent_data:
            query["dependentData"] = self.dependent_data

        urlparts[4] = urlencode(query)
        return str(urlunparse(urlparts))

    # response format must be:
    # https://docs.sentry.io/organization/integrations/integration-platform/ui-components/formfield/#uri-response-format
    def _validate_response(self, resp: Sequence[dict[str, Any]]) -> bool:
        return validate(instance=resp, schema_type="select")

    def _format_response(self, resp: Sequence[dict[str, Any]]) -> SelectRequesterResult:
        # the UI expects the following form:
        # choices: [[label, value]]
        # default: [label, value]
        response: SelectRequesterResult = {}
        choices: list[list[str]] = []

        for option in resp:
            if not ("value" in option and "label" in option):
                raise SentryAppIntegratorError(
                    message="Missing `value` or `label` in option data for Select FormField",
                    webhook_context={
                        "error_type": FAILURE_REASON_BASE.format(
                            SentryAppExternalRequestHaltReason.MISSING_FIELDS
                        ),
                        "response": resp,
                    },
                    status_code=500,
                )

            choices.append([option["value"], option["label"]])

            if option.get("default"):
                response["defaultValue"] = option["value"]

        response["choices"] = choices
        return response

    def _build_headers(self) -> dict[str, str]:
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(""),
        }

    @cached_property
    def sentry_app(self) -> RpcSentryApp:
        return self.install.sentry_app
