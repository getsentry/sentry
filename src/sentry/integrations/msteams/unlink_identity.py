from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.messaging.linkage import UnlinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.msteams.linkage import MsTeamsIdentityLinkageView
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from .card_builder.identity import build_unlinked_card
from .constants import SALT
from .utils import get_preinstall_client


def build_unlinking_url(conversation_id, service_url, teams_user_id):
    signed_params = sign(
        salt=SALT,
        conversation_id=conversation_id,
        service_url=service_url,
        teams_user_id=teams_user_id,
    )

    return absolute_uri(
        reverse(
            "sentry-integration-msteams-unlink-identity", kwargs={"signed_params": signed_params}
        )
    )


class MsTeamsUnlinkIdentityView(MsTeamsIdentityLinkageView, UnlinkIdentityView):
    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/msteams/unlinked.html", {}

    @property
    def confirmation_template(self) -> str:
        return "sentry/integrations/msteams/unlink-identity.html"

    @property
    def no_identity_template(self) -> str | None:
        return "sentry/integrations/msteams/no-identity.html"

    @property
    def filter_by_user_id(self) -> bool:
        return True

    def notify_on_success(
        self, external_id: str, params: Mapping[str, Any], integration: Integration | None
    ) -> None:
        client = get_preinstall_client(params["service_url"])
        card = build_unlinked_card()
        client.send_card(params["conversation_id"], card)
