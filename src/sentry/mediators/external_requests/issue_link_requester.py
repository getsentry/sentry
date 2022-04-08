import logging
from urllib.parse import urlparse
from uuid import uuid4

from sentry.coreapi import APIError
from sentry.http import safe_urlread
from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests.util import send_and_save_sentry_app_request, validate
from sentry.utils import json
from sentry.utils.cache import memoize

logger = logging.getLogger("sentry.mediators.external-requests")


class IssueLinkRequester(Mediator):
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

    install = Param("sentry.models.SentryAppInstallation")
    uri = Param((str,))
    group = Param("sentry.models.Group")
    fields = Param(object)
    user = Param("sentry.models.User")
    action = Param((str,))

    def call(self):
        return self._make_request()

    def _build_url(self):
        urlparts = urlparse(self.sentry_app.webhook_url)
        return f"{urlparts.scheme}://{urlparts.netloc}{self.uri}"

    def _make_request(self):
        action_to_past_tense = {"create": "created", "link": "linked"}

        try:
            req = send_and_save_sentry_app_request(
                self._build_url(),
                self.sentry_app,
                self.install.organization_id,
                f"external_issue.{action_to_past_tense[self.action]}",
                headers=self._build_headers(),
                method="POST",
                data=self.body,
            )
            body = safe_urlread(req)
            response = json.loads(body)
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
            response = {}

        if not self._validate_response(response):
            raise APIError()

        return response

    def _validate_response(self, resp):
        return validate(instance=resp, schema_type="issue_link")

    def _build_headers(self):
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(self.body),
        }

    @memoize
    def body(self):
        body = {"fields": {}}
        for name, value in self.fields.items():
            body["fields"][name] = value

        body["issueId"] = self.group.id
        body["installationId"] = self.install.uuid
        body["webUrl"] = self.group.get_absolute_url()
        project = self.group.project
        body["project"] = {"slug": project.slug, "id": project.id}
        body["actor"] = {"type": "user", "id": self.user.id, "name": self.user.name}
        return json.dumps(body)

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
