import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from django.utils.functional import cached_property
from jsonschema import ValidationError

from sentry.coreapi import APIError
from sentry.http import safe_urlread
from sentry.models.group import Group
from sentry.sentry_apps.external_requests.utils import send_and_save_sentry_app_request, validate
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.users.services.user import RpcUser
from sentry.utils import json

logger = logging.getLogger("sentry.sentry_apps.external_requests")
ACTION_TO_PAST_TENSE = {"create": "created", "link": "linked"}


@dataclass
class IssueLinkRequester:
    """
    1. Makes a POST request to another service with data used for creating or
    linking a Sentry issue to an issue in the other service.

    The data sent to the other service is always in the following format:
        {
            'installationId': <install_uuid>,
            'issueId': <sentry_group_id>,
            'webUrl': <sentry_group_web_url>,
            <fields>,
        }

    <fields> are any of the 'create' or 'link' form fields (determined by
    the schema for that particular service)

    2. Validates the response format from the other service and returns the
    payload.

    The data sent to the other service is always in the following format:
        {
            'identifier': <some_identifier>,
            'webUrl': <external_issue_web_url>,
            'project': <top_level_identifier>,
        }

    The project and identifier are use to generate the display text for the linked
    issue in the UI (i.e. <project>#<identifier>)
    """

    install: RpcSentryAppInstallation
    uri: str
    group: Group
    fields: dict[str, Any]
    user: RpcUser
    action: str

    def run(self) -> dict[str, Any]:
        response: dict[str, str] = {}

        try:
            request = send_and_save_sentry_app_request(
                self._build_url(),
                self.sentry_app,
                self.install.organization_id,
                f"external_issue.{ACTION_TO_PAST_TENSE[self.action]}",
                headers=self._build_headers(),
                method="POST",
                data=self.body,
            )
            body = safe_urlread(request)
            response = json.loads(body)
        except (json.JSONDecodeError, TypeError):
            raise ValidationError(f"Unable to parse response from {self.sentry_app.slug}")
        except Exception as e:
            logger.info(
                "issue-link-requester.error",
                extra={
                    "sentry_app": self.sentry_app.slug,
                    "install": self.install.uuid,
                    "project": self.group.project.slug,
                    "group": self.group.id,
                    "uri": self.uri,
                    "error_message": str(e),
                },
            )
            raise APIError(
                f"Issue occured while trying to contact {self.sentry_app.slug} to link issue"
            )

        if not self._validate_response(response):
            raise ValidationError(
                f"Invalid response format from sentry app {self.sentry_app} when linking issue"
            )

        return response

    def _build_url(self) -> str:
        urlparts = urlparse(self.sentry_app.webhook_url)
        return f"{urlparts.scheme}://{urlparts.netloc}{self.uri}"

    def _validate_response(self, resp: dict[str, str]) -> bool:
        return validate(instance=resp, schema_type="issue_link")

    def _build_headers(self) -> dict[str, str]:
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(self.body),
        }

    @cached_property
    def body(self):
        body: dict[str, Any] = {
            "fields": {},
            "issueId": self.group.id,
            "installationId": self.install.uuid,
            "webUrl": self.group.get_absolute_url(),
            "project": {"slug": self.group.project.slug, "id": self.group.project.id},
            "actor": {"type": "user", "id": self.user.id, "name": self.user.name},
        }
        body["fields"].update(self.fields)

        return json.dumps(body)

    @cached_property
    def sentry_app(self):
        return self.install.sentry_app
