from typing import Any

from pydantic import root_validator

from sentry.hybridcloud.rpc import RpcModel


class RpcOrganizationSlugReservation(RpcModel):
    id: int
    organization_id: int
    user_id: int | None
    slug: str
    cell_name: str
    reservation_type: int

    @root_validator(pre=True)
    @classmethod
    def _accept_region_name(cls, values: dict[str, Any]) -> dict[str, Any]:
        if "region_name" in values and "cell_name" not in values:
            values["cell_name"] = values.pop("region_name")
        return values

    @property
    def region_name(self) -> str:
        return self.cell_name
