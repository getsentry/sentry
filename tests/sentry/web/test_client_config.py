from __future__ import annotations

import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings

from sentry import options
from sentry.app import env
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
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

    base_line = get_client_config(request)

    # Removing the region list as it varies based on silo mode.
    # See Region.to_url()
    base_line.pop("regions")
    base_line["links"].pop("regionUrl")
    cache.clear()

    for silo_mode in SiloMode:
        with override_settings(SILO_MODE=silo_mode):
            result = get_client_config(request)
            result.pop("regions")
            result["links"].pop("regionUrl")
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
def test_client_config_default_region_data():
    request, user = make_user_request_from_org()
    request.user = user
    result = get_client_config(request)

    assert len(result["regions"]) == 1
    regions = result["regions"]
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
