from typing import Any, Union

import pydantic


class OrganizationOptions(pydantic.BaseModel):
    name: str
    slug: str
    owning_user_id: int
    create_default_team: bool = True


class PostProvisionOptions(pydantic.BaseModel):
    sentry_options: Union[Any, None]  # Placeholder for any sentry post-provisioning data
    getsentry_options: Union[Any, None]  # Reserved for getsentry post-provisioning data


class OrganizationProvisioningOptions(pydantic.BaseModel):
    provision_options: OrganizationOptions
    post_provision_options: PostProvisionOptions
