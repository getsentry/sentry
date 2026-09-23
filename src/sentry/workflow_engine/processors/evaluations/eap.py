from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def emit_evaluations_to_eap(
    artifacts: list[dict[str, object]], organization: "Organization"
) -> None:
    pass
