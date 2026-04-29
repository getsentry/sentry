from typing import Any

import pydantic

from sentry.users.services.user.model import RpcUser


class OrganizationOptions(pydantic.BaseModel):
    name: str
    slug: str
    # Deprecated use owner instead.
    owning_user_id: int | None = None
    # Deprecated use owner instead.
    owning_email: str | None = None
    owner: RpcUser | None = None
    create_default_team: bool = True
    is_test: bool = False
    ip_address: str | None = None
    agree_terms: bool | None = None
    aggregated_data_consent: bool | None = None
    channel_name: str | None = None


class PostProvisionOptions(pydantic.BaseModel):
    sentry_options: Any | None = None  # Placeholder for any sentry post-provisioning data
    getsentry_options: Any | None = None  # Reserved for getsentry post-provisioning data


class OrganizationProvisioningOptions(pydantic.BaseModel):
    provision_options: OrganizationOptions
    post_provision_options: PostProvisionOptions
