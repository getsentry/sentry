from typing import Any, Union

import pydantic


class OrganizationOptions(pydantic.BaseModel):
    name: str
    slug: str
    owning_user_id: int
    create_default_team: bool = True
    is_test = False


class PostProvisionOptions(pydantic.BaseModel):
    sentry_options: Union[Any, None]  # Placeholder for any sentry post-provisioning data
    getsentry_options: Union[Any, None]  # Reserved for getsentry post-provisioning data


class OrganizationProvisioningOptions(pydantic.BaseModel):
    provision_options: OrganizationOptions
    post_provision_options: PostProvisionOptions


class RpcOrganizationSlugReservation(pydantic.BaseModel):
    organization_id: int
    user_id: int
    slug: str
    region_name: str
