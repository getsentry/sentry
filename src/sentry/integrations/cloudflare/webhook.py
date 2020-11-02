from __future__ import absolute_import

import hmac
import logging
import six

from django.utils.crypto import constant_time_compare
from functools import wraps
from hashlib import sha256
from rest_framework.response import Response

from sentry import options
from sentry.api.authentication import TokenAuthentication
from sentry.api.base import Endpoint
from sentry.models import Organization, Project, ProjectKey, Team

logger = logging.getLogger("sentry.integrations.cloudflare")


def requires_auth(func):
    @wraps(func)
    def wrapped(self, request, *args, **kwargs):
        if not request.user.is_authenticated():
            return Response({"proceed": False}, 401)
        return func(self, request, *args, **kwargs)

    return wrapped


class CloudflareTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        # XXX(dcramer): Hack around CF needing a token in the JSON body,
        # but us additionally needing to verify the signature of the payload.
        # This technically lets a user brute force a token before we actually
        # verify the signature, HOWEVER, they could do that either way so we
        # are ok with it.
        try:
            token = request.data["authentications"]["account"]["token"]["token"]
        except KeyError:
            return None
        return self.authenticate_credentials(request, token)


class CloudflareWebhookEndpoint(Endpoint):
    authentication_classes = (CloudflareTokenAuthentication,)
    permission_classes = ()

    def verify(self, payload, key, signature):
        return constant_time_compare(
            signature, hmac.new(key=key.encode("utf-8"), msg=payload, digestmod=sha256).hexdigest(),
        )

    def organization_from_json(self, request, data, scope="project:write"):
        try:
            organization_id = data["install"]["options"]["organization"]
        except KeyError:
            return None

        organizations = Organization.objects.get_for_user(request.user, scope=scope)
        for org in organizations:
            if six.text_type(org.id) == organization_id:
                return org
        return None

    def project_from_json(self, request, data, scope="project:write"):
        try:
            project_id = data["install"]["options"]["project"]
        except KeyError:
            return None

        org = self.organization_from_json(request, data)

        projects = Project.objects.filter(
            organization=org,
            teams__in=Team.objects.get_for_user(org, request.user, scope="project:write"),
        )
        for project in projects:
            if six.text_type(project.id) == project_id:
                return project
        return None

    def on_preview(self, request, data, is_test):
        if not request.user.is_authenticated():
            return Response({"install": data["install"], "proceed": True})

        return self.on_account_change(request, data, is_test)

    @requires_auth
    def on_account_change(self, request, data, is_test):
        organizations = sorted(
            Organization.objects.get_for_user(request.user, scope="project:write"),
            key=lambda x: x.slug,
        )

        enum_choices = [six.text_type(o.id) for o in organizations]

        data["install"]["schema"]["properties"]["organization"] = {
            "type": "string",
            "title": "Sentry Organization",
            "order": 1,
            "enum": enum_choices,
            "enumNames": {six.text_type(o.id): o.slug for o in organizations},
            "required": True,
        }
        if not enum_choices:
            return self.on_organization_clear(request, data, is_test)

        if data["install"]["options"].get("organization") not in enum_choices:
            data["install"]["options"]["organization"] = enum_choices[0]

        return self.on_organization_change(request, data, is_test)

    @requires_auth
    def on_organization_clear(self, request, data, is_test):
        data["install"]["schema"]["properties"].pop("project", None)
        data["install"]["schema"]["properties"].pop("dsn", None)
        data["install"]["options"].pop("organization", None)
        data["install"]["options"].pop("project", None)
        data["install"]["options"].pop("dsn", None)
        return Response({"install": data["install"], "proceed": True})

    @requires_auth
    def on_organization_change(self, request, data, is_test):
        org = self.organization_from_json(request, data)

        projects = sorted(
            Project.objects.filter(
                organization=org,
                teams__in=Team.objects.get_for_user(org, request.user, scope="project:write"),
            ),
            key=lambda x: x.slug,
        )

        enum_choices = [six.text_type(o.id) for o in projects]

        data["install"]["schema"]["properties"]["project"] = {
            "type": "string",
            "title": "Sentry Project",
            "order": 2,
            "enum": enum_choices,
            "enumNames": {six.text_type(o.id): o.slug for o in projects},
            "required": True,
        }
        if not enum_choices:
            return self.on_project_clear(request, data, is_test)

        if data["install"]["options"].get("project") not in enum_choices:
            data["install"]["options"]["project"] = enum_choices[0]

        return self.on_project_change(request, data, is_test)

    @requires_auth
    def on_project_clear(self, request, data, is_test):
        data["install"]["schema"]["properties"].pop("dsn", None)
        data["install"]["options"].pop("project", None)
        data["install"]["options"].pop("dsn", None)
        return Response({"install": data["install"], "proceed": True})

    @requires_auth
    def on_project_change(self, request, data, is_test):
        project = self.project_from_json(request, data)

        keys = sorted(ProjectKey.objects.filter(project=project), key=lambda x: x.public_key)

        enum_choices = [o.get_dsn(public=True) for o in keys]

        data["install"]["schema"]["properties"]["dsn"] = {
            "type": "string",
            "title": "DSN",
            "description": "Your automatically configured DSN for communicating with Sentry.",
            "placeholder": "https://public_key@sentry.io/1",
            "order": 3,
            "enum": enum_choices,
            "required": True,
        }
        if not enum_choices:
            return self.on_dsn_clear(request, data, is_test)

        if data["install"]["options"].get("dsn") not in enum_choices:
            data["install"]["options"]["dsn"] = enum_choices[0]

        return Response({"install": data["install"], "proceed": True})

    @requires_auth
    def on_dsn_clear(self, request, data, is_test):
        data["install"]["options"].pop("dsn", None)
        return Response({"install": data["install"], "proceed": True})

    def post(self, request):
        signature = request.META.get("HTTP_X_SIGNATURE_HMAC_SHA256_HEX")
        variant = request.META.get("HTTP_X_SIGNATURE_KEY_VARIANT")
        logging_data = {
            "user_id": request.user.id if request.user.is_authenticated() else None,
            "signature": signature,
            "variant": variant,
        }

        payload = request.body
        try:
            data = request.data
        except (ValueError, TypeError):
            logger.error("cloudflare.webhook.invalid-json", extra=logging_data)
            return Response(status=400)

        event = data.get("event")
        logger.info(u"cloudflare.webhook.{}".format(event), extra=logging_data)
        if not signature:
            logger.error("cloudflare.webhook.invalid-signature", extra=logging_data)
            return Response(status=400)
        if not variant:
            logger.error("cloudflare.webhook.invalid-variant", extra=logging_data)
            return Response(status=400)

        if variant == "test":
            key = "test-key"
        elif variant == "1":
            key = options.get("cloudflare.secret-key")
        else:
            logger.error("cloudflare.webhook.invalid-variant", extra=logging_data)
            return Response(status=400)

        app_id = data.get("app", {}).get("id")
        if app_id not in ("local", "") and variant == "test":
            logger.error("cloudflare.webhook.invalid-variant", extra=logging_data)
            return Response(status=400)

        if not self.verify(payload, key, signature):
            logger.error(u"cloudflare.webhook.invalid-signature".format(event), extra=logging_data)
            return Response(status=400)

        if event == "option-change:account":
            return self.on_account_change(request, data, is_test=variant == "test")
        if event == "option-change:organization":
            return self.on_organization_change(request, data, is_test=variant == "test")
        if event == "option-change:project":
            return self.on_project_change(request, data, is_test=variant == "test")
        elif event == "preview":
            return self.on_preview(request, data, is_test=variant == "test")
        return Response({"install": data["install"], "proceed": True})
