from __future__ import annotations

import urllib.parse
from typing import Any

import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import get_resolver

from sentry import options
from sentry.app import env
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.region import get_test_env_directory
from sentry.testutils.requests import (
    RequestFactory,
    make_request,
    make_user_request,
    make_user_request_from_org,
    request_factory,
)
from sentry.testutils.silo import (
    assume_test_silo_mode_of,
    control_silo_test,
    create_test_regions,
    no_silo_test,
)
from sentry.types import region
from sentry.web.client_config import get_client_config


@request_factory
def make_user_request_from_non_existant_org(org=None):
    request, user = make_user_request_from_org(org)
    # This is a non existant value that will fail lookup.
    request.session["activeorg"] = 47381
    return request, user


def make_user_request_from_org_with_auth_identities(org=None):
    request, user = make_user_request_from_org(org)
    with assume_test_silo_mode_of(Organization):
        org = Organization.objects.get_for_user_ids({user.id})[0]
    provider = AuthProvider.objects.create(
        organization_id=org.id, provider="google", config={"domain": "olddomain.com"}
    )
    AuthIdentity.objects.create(user=user, auth_provider=provider, ident="me@google.com", data={})
    return request, user


@request_factory
def none_request() -> None:
    return None


@pytest.fixture(autouse=True)
def clear_env_request():
    env.clear()
    yield
    env.clear()


multiregion_client_config_test = control_silo_test(
    regions=create_test_regions("us", "eu", "acme", single_tenants=["acme"]),
    include_monolith_run=True,
)


@no_silo_test
@django_db_all
def test_client_config_default():
    cfg = get_client_config()
    assert cfg["sentryMode"] == "SELF_HOSTED"


@multiregion_client_config_test
@pytest.mark.parametrize(
    "request_factory",
    [
        none_request,
        make_request,
        make_user_request,
        make_user_request_from_org,
        make_user_request_from_non_existant_org,
        make_user_request_from_org_with_auth_identities,
    ],
)
@django_db_all(transaction=True)
def test_client_config_in_silo_modes(request_factory: RequestFactory):
    request_ret = request_factory()
    if request_ret is not None:
        request, _ = request_ret
    else:
        request = None

    base_line = dict(get_client_config(request))

    def normalize(value: dict[str, Any]):
        # Removing the region lists as it varies based on silo mode.
        # See Region.to_url()
        value.pop("regions")
        value.pop("memberRegions")
        value["links"].pop("regionUrl")

    normalize(base_line)
    cache.clear()

    for silo_mode in SiloMode:
        with override_settings(SILO_MODE=silo_mode):
            result = dict(get_client_config(request))
            normalize(result)
            assert result == base_line
            cache.clear()


@no_silo_test
@django_db_all(transaction=True)
def test_client_config_deleted_user():
    request, user = make_user_request_from_org()
    request.user = user

    user.delete()

    result = get_client_config(request)
    assert result["isAuthenticated"] is False
    assert result["user"] is None


@no_silo_test
@django_db_all
def test_client_config_features():
    request, user = make_user_request_from_org()
    request.user = user
    result = get_client_config(request)

    assert "features" in result
    assert "organizations:create" in result["features"]
    assert "system:multi-region" not in result["features"]

    with (
        override_options({"auth.allow-registration": True}),
        Feature({"auth:register": True, "system:multi-region": True}),
    ):
        result = get_client_config(request)

        assert "features" in result
        assert "system:multi-region" in result["features"]
        assert "auth:register" in result["features"]


@no_silo_test
@django_db_all
def test_client_config_default_region_data():
    request, user = make_user_request_from_org()
    request.user = user
    result = get_client_config(request)

    assert len(result["regions"]) == 1
    regions = result["regions"]
    assert regions[0]["name"] == settings.SENTRY_MONOLITH_REGION
    assert regions[0]["url"] == options.get("system.url-prefix")

    assert len(result["memberRegions"]) == 1
    regions = result["memberRegions"]
    assert regions[0]["name"] == settings.SENTRY_MONOLITH_REGION
    assert regions[0]["url"] == options.get("system.url-prefix")


@no_silo_test
@django_db_all
def test_client_config_empty_region_data():
    region_directory = region.load_from_config(())

    # Usually, we would want to use other testutils functions rather than calling
    # `swap_state` directly. We make an exception here in order to test the default
    # region data that `load_from_config` fills in.
    with get_test_env_directory().swap_state(tuple(region_directory.regions)):
        request, user = make_user_request_from_org()
        request.user = user
        result = get_client_config(request)

    assert len(result["regions"]) == 1
    regions = result["regions"]
    assert regions[0]["name"] == settings.SENTRY_MONOLITH_REGION
    assert regions[0]["url"] == options.get("system.url-prefix")


@multiregion_client_config_test
@django_db_all
def test_client_config_with_region_data():
    request, user = make_user_request_from_org()
    request.user = user
    result = get_client_config(request)

    assert len(result["regions"]) == 2
    regions = result["regions"]
    assert {r["name"] for r in regions} == {"eu", "us"}

    assert len(result["memberRegions"]) == 1


hidden_regions = [
    region.Region(
        name="us",
        snowflake_id=1,
        address="https//us.testserver",
        category=region.RegionCategory.MULTI_TENANT,
    ),
    region.Region(
        name="eu",
        snowflake_id=5,
        address="https//eu.testserver",
        visible=False,
        category=region.RegionCategory.MULTI_TENANT,
    ),
]


@control_silo_test(regions=hidden_regions, include_monolith_run=True)
@django_db_all
def test_client_config_with_hidden_region_data():
    request, user = make_user_request_from_org()
    request.user = user
    result = get_client_config(request)

    assert len(result["regions"]) == 1
    regions = result["regions"]
    assert {r["name"] for r in regions} == {"us"}
    assert len(result["memberRegions"]) == 1


@multiregion_client_config_test
@django_db_all
def test_client_config_with_multiple_membership():
    request, user = make_user_request_from_org()
    request.user = user

    # multiple us memberships and eu too
    Factories.create_organization(slug="us-co", owner=user)
    Factories.create_organization(slug="eu-co", owner=user)
    mapping = OrganizationMapping.objects.get(slug="eu-co")
    mapping.update(region_name="eu")

    result = get_client_config(request)

    # Single-tenant doesn't show up unless you have membership
    assert len(result["regions"]) == 2
    regions = result["regions"]
    assert {r["name"] for r in regions} == {"eu", "us"}

    assert len(result["memberRegions"]) == 2
    regions = result["memberRegions"]
    assert {r["name"] for r in regions} == {"eu", "us"}


@multiregion_client_config_test
@django_db_all
def test_client_config_with_single_tenant_membership():
    request, user = make_user_request_from_org()
    request.user = user

    Factories.create_organization(slug="acme-co", owner=user)
    mapping = OrganizationMapping.objects.get(slug="acme-co")
    mapping.update(region_name="acme")

    result = get_client_config(request)

    assert len(result["regions"]) == 3
    regions = result["regions"]
    assert {r["name"] for r in regions} == {"eu", "us", "acme"}

    assert len(result["memberRegions"]) == 2
    regions = result["memberRegions"]
    assert {r["name"] for r in regions} == {"us", "acme"}


@multiregion_client_config_test
@django_db_all
def test_client_config_links_regionurl():
    request, user = make_user_request_from_org()
    request.user = user

    with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
        result = get_client_config(request)
        assert result["links"]
        assert result["links"]["regionUrl"] == "http://us.testserver"

    with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_REGION=None):
        result = get_client_config(request)
        assert result["links"]
        assert result["links"]["regionUrl"] == "http://us.testserver"

    with override_settings(SILO_MODE=SiloMode.MONOLITH, SENTRY_REGION="eu"):
        result = get_client_config(request)
        assert result["links"]
        assert result["links"]["regionUrl"] == "http://eu.testserver"


@control_silo_test(
    regions=create_test_regions("us", "eu", "acme", "de", "apac", single_tenants=["acme"]),
    include_monolith_run=True,
)
@django_db_all
def test_client_config_region_display_order():
    request, user = make_user_request_from_org()
    request.user = user

    Factories.create_organization(slug="acme-co", owner=user)
    mapping = OrganizationMapping.objects.get(slug="acme-co")
    mapping.update(region_name="acme")

    result = get_client_config(request)
    region_names = [region["name"] for region in result["regions"]]
    assert region_names == ["us", "apac", "de", "eu", "acme"]


@multiregion_client_config_test
@django_db_all
def test_client_config_links_with_priority_org():
    request, user = make_user_request_from_org()
    request.user = user

    org = Factories.create_organization()
    Factories.create_member(organization=org, user=user)

    org_context = organization_service.get_organization_by_slug(
        slug=org.slug, only_visible=False, user_id=user.id
    )

    # we want the org context to have priority over the active org
    assert request.session["activeorg"] != org.slug

    with override_settings(SILO_MODE=SiloMode.REGION, SENTRY_REGION="us"):
        result = get_client_config(request, org_context)
        assert result["links"]
        assert result["links"]["regionUrl"] == "http://us.testserver"
        assert result["links"]["organizationUrl"] == f"http://{org.slug}.testserver"

    with override_settings(SILO_MODE=SiloMode.CONTROL, SENTRY_REGION=None):
        result = get_client_config(request, org_context)
        assert result["links"]
        assert result["links"]["regionUrl"] == "http://us.testserver"
        assert result["links"]["organizationUrl"] == f"http://{org.slug}.testserver"


@django_db_all
def test_project_key_default():
    organization = Factories.create_organization(name="test-org")
    project = Factories.create_project(organization=organization)
    project_key = Factories.create_project_key(project)
    assert project_key.dsn_public

    with override_settings(SENTRY_PROJECT=project.id):
        assert get_client_config()["dsn"] == project_key.dsn_public


@no_silo_test
@django_db_all
def test_client_config_no_preload_data_if_accept_invitation_view():
    request, user = make_user_request_from_org()
    request.user = user

    member = Factories.create_member(
        user=None,
        email=user.email,
        organization=Factories.create_organization(name="test-org"),
        role="owner",
    )
    invite_url = member.get_invite_link()
    invite_path = urllib.parse.urlparse(invite_url).path
    resolver = get_resolver()
    request.path = invite_path
    request.resolver_match = resolver.resolve(invite_path)

    client_config = get_client_config(request)

    assert client_config["shouldPreloadData"] is False
