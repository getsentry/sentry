from typing import Any

import pydantic


class OrganizationOptions(pydantic.BaseModel):
    name: str
    slug: str
    owning_user_id: int | None = None
    owning_email: str | None = None
    create_default_team: bool = True
    is_test = False


class PostProvisionOptions(pydantic.BaseModel):
    sentry_options: Any | None  # Placeholder for any sentry post-provisioning data
    getsentry_options: Any | None  # Reserved for getsentry post-provisioning data


class OrganizationProvisioningOptions(pydantic.BaseModel):
    provision_options: OrganizationOptions
    post_provision_options: PostProvisionOptions
