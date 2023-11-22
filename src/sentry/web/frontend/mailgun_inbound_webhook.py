import hmac
import logging
from hashlib import sha256
from typing import Any

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from email_reply_parser import EmailReplyParser

from sentry import options
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope
from sentry.utils.email import email_to_group_id
from sentry.web.frontend.base import control_silo_view

logger = logging.getLogger("sentry.mailgun")


@control_silo_view
class MailgunInboundWebhookView(View):
    def verify(self, api_key, token, timestamp, signature):
        return constant_time_compare(
            signature,
            hmac.new(
                key=api_key.encode("utf-8"),
                msg=(f"{timestamp}{token}").encode(),
                digestmod=sha256,
            ).hexdigest(),
        )

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        token = request.POST["token"]
        signature = request.POST["signature"]
        timestamp = request.POST["timestamp"]

        key = options.get("mail.mailgun-api-key")
        if not key:
            logger.error("mailgun.api-key-missing")
            return HttpResponse(status=500)

        if not self.verify(key, token, timestamp, signature):
            logger.info(
                "mailgun.invalid-signature",
                extra={"token": token, "timestamp": timestamp, "signature": signature},
            )
            return HttpResponse(status=200)

        to_email = request.POST["recipient"]
        from_email = request.POST["sender"]

        try:
            # This needs to return a tuple of orgid, groupid
            group_id, org_id = email_to_group_id(to_email)
        except Exception:
            logger.info("mailgun.invalid-email", extra={"email": to_email})
            return HttpResponse(status=200)

        payload = EmailReplyParser.parse_reply(request.POST["body-plain"]).strip()
        if not payload:
            # If there's no body, we don't need to go any further
            return HttpResponse(status=200)

        if org_id:
            org_mapping = OrganizationMapping.objects.get(organization_id=org_id)
            region_name = org_mapping.region_name
        else:
            region_name = settings.SENTRY_MONOLITH_REGION

        # Email replies cannot be coaleseced so we
        # need to generate unique object_identifier values.
        outbox_payload: Any = {"from_email": from_email, "text": payload, "group_id": group_id}
        outbox = ControlOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=org_id or 0,
            category=OutboxCategory.ISSUE_COMMENT_UPDATE,
            object_identifier=ControlOutbox.next_object_identifier(),
            region_name=region_name,
            payload=outbox_payload,
        )
        outbox.save()

        return HttpResponse(status=201)
