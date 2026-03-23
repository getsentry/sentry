from typing import Any

from pydantic import root_validator

from sentry.hybridcloud.rpc import RpcModel


class RpcOrganizationSlugReservation(RpcModel):
    id: int
    organization_id: int
    user_id: int | None
    slug: str
    region_name: str
    reservation_type: int

    @root_validator(pre=True)
    @classmethod
    def _accept_cell_name(cls, values: dict[str, Any]) -> dict[str, Any]:
        if "cell_name" in values and "region_name" not in values:
            values["region_name"] = values.pop("cell_name")
        return values

    @property
    def cell_name(self) -> str:
        return self.region_name
