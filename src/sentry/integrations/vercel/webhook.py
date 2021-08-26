import logging

from .generic_webhook import VercelGenericWebhookEndpoint, verify_signature

logger = logging.getLogger("sentry.integrations.vercel.webhooks")


class VercelWebhookEndpoint(VercelGenericWebhookEndpoint):
    """
    Webhooks created by the API during installation.

    To be deprecated on August 20, 2021, replaced by the Generic
    Webhook set on the Vercel app.

    """

    def post(self, request):
        if not request.META.get("HTTP_X_ZEIT_SIGNATURE"):
            logger.error("vercel.webhook.missing-signature")
            return self.respond(status=401)

        is_valid = verify_signature(request)

        if not is_valid:
            logger.error("vercel.webhook.invalid-signature")
            return self.respond(status=401)

        external_id = request.data.get("teamId") or request.data.get("userId")
        if not external_id:
            return self.respond({"detail": "Either teamId or userId must be defined"}, status=400)

        return self._deployment_created(external_id, request)
