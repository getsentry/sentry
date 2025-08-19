from __future__ import annotations

import logging
from base64 import b64encode
from typing import Any

from django.utils.encoding import force_bytes
from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.integrations.services.integration import RpcIntegration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


class TwilioClient(ApiClient):
    base_url = "https://api.twilio.com/2010-04-01"
    integration_name = "twilio"

    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        messaging_service_sid: str | None = None,
        sms_from: str | None = None,
        sms_to: list[str] | None = None,
    ) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.messaging_service_sid = messaging_service_sid
        self.sms_from = sms_from
        self.sms_to = sms_to or []
        super().__init__()

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = self._basic_auth()
        return prepared_request

    def _basic_auth(self) -> str:
        credentials = f"{self.account_sid}:{self.auth_token}"
        encoded = b64encode(force_bytes(credentials))
        return f"Basic {encoded.decode('ascii')}"

    def send_sms(self, to: str, body: str, from_: str | None = None) -> dict[str, Any]:
        """Send an SMS message using Twilio API."""
        path = f"/Accounts/{self.account_sid}/Messages.json"

        data = {
            "To": to,
            "Body": body,
        }

        # Use Messaging Service SID if available, otherwise use From number
        if self.messaging_service_sid:
            data["MessagingServiceSid"] = self.messaging_service_sid
        else:
            if from_ is None:
                from_ = self.sms_from
            if not from_:
                raise ApiError("Either Messaging Service SID or SMS from number is required")
            data["From"] = from_

        try:
            # Twilio requires form-encoded data, not JSON
            response = self.post(path, data=data, json=False)
            return response
        except ApiError as e:
            logger.exception(
                "twilio.send_sms.error",
                extra={
                    "account_sid": self.account_sid,
                    "to": to,
                    "error": str(e),
                },
            )
            raise

    def verify_credentials(self) -> dict[str, Any]:
        """Verify that the provided credentials are valid."""
        path = f"/Accounts/{self.account_sid}.json"

        try:
            response = self.get(path)
            return response
        except ApiError as e:
            logger.exception(
                "twilio.verify_credentials.error",
                extra={
                    "account_sid": self.account_sid,
                    "error": str(e),
                },
            )
            raise

    def get_phone_number_info(self, phone_number: str) -> dict[str, Any]:
        """Get information about a phone number."""
        path = f"/Accounts/{self.account_sid}/IncomingPhoneNumbers.json"

        try:
            response = self.get(path, params={"PhoneNumber": phone_number})
            return response
        except ApiError as e:
            logger.exception(
                "twilio.get_phone_number_info.error",
                extra={
                    "account_sid": self.account_sid,
                    "phone_number": phone_number,
                    "error": str(e),
                },
            )
            raise


class TwilioApiClient(TwilioClient):
    def __init__(self, integration: RpcIntegration) -> None:
        metadata = integration.metadata
        account_sid = metadata.get("account_sid", "")
        auth_token = metadata.get("auth_token", "")
        messaging_service_sid = metadata.get("messaging_service_sid", "")
        sms_from = metadata.get("sms_from", "")
        sms_to = metadata.get("sms_to", [])

        super().__init__(
            account_sid=account_sid,
            auth_token=auth_token,
            messaging_service_sid=messaging_service_sid,
            sms_from=sms_from,
            sms_to=sms_to,
        )
