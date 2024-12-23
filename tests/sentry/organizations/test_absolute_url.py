import pytest

from sentry.organizations.absolute_url import customer_domain_path


@pytest.mark.parametrize(
    ("input", "expected"),
    (
        ("/settings/", "/settings/"),
        # Organization settings views.
        ("/settings/acme/", "/settings/organization/"),
        ("/settings/organization", "/settings/organization/"),
        ("/settings/sentry/members/", "/settings/members/"),
        ("/settings/sentry/members/3/", "/settings/members/3/"),
        ("/settings/sentry/teams/peeps/", "/settings/teams/peeps/"),
        ("/settings/sentry/billing/receipts/", "/settings/billing/receipts/"),
        (
            "/settings/acme/developer-settings/release-bot/",
            "/settings/developer-settings/release-bot/",
        ),
        # Settings views for orgs with account/billing in their slugs.
        ("/settings/account-on/", "/settings/organization/"),
        ("/settings/billing-co/", "/settings/organization/"),
        ("/settings/account-on/integrations/", "/settings/integrations/"),
        (
            "/settings/account-on/projects/billing-app/source-maps/",
            "/settings/projects/billing-app/source-maps/",
        ),
        ("/settings/billing-co/integrations/", "/settings/integrations/"),
        (
            "/settings/billing-co/projects/billing-app/source-maps/",
            "/settings/projects/billing-app/source-maps/",
        ),
        # Account settings should stay the same
        ("/settings/account/", "/settings/account/"),
        ("/settings/account/security/", "/settings/account/security/"),
        ("/settings/account/details/", "/settings/account/details/"),
        ("/join-request/acme", "/join-request/"),
        ("/join-request/acme/", "/join-request/"),
        ("/onboarding/acme/", "/onboarding/"),
        ("/onboarding/acme/project/", "/onboarding/project/"),
        ("/organizations/new/", "/organizations/new/"),
        ("/organizations/albertos-apples/issues/", "/issues/"),
        ("/organizations/albertos-apples/issues/?_q=all#hash", "/issues/?_q=all#hash"),
        ("/acme/project-slug/getting-started/", "/getting-started/project-slug/"),
        (
            "/acme/project-slug/getting-started/python",
            "/getting-started/project-slug/python",
        ),
        ("/settings/projects/python/filters/", "/settings/projects/python/filters/"),
        ("/settings/projects/onboarding/abc123/", "/settings/projects/onboarding/abc123/"),
        (
            "/settings/projects/join-request/abc123/",
            "/settings/projects/join-request/abc123/",
        ),
        (
            "/settings/projects/python/filters/discarded/",
            "/settings/projects/python/filters/discarded/",
        ),
        (
            "/settings/projects/getting-started/abc123/",
            "/settings/projects/getting-started/abc123/",
        ),
        ("/settings/teams/peeps/", "/settings/teams/peeps/"),
        ("/settings/billing/checkout/?_q=all#hash", "/settings/billing/checkout/?_q=all#hash"),
        (
            "/settings/billing/bundle-checkout/?_q=all#hash",
            "/settings/billing/bundle-checkout/?_q=all#hash",
        ),
    ),
)
def test_customer_domain_path(input: str, expected: str) -> None:
    assert expected == customer_domain_path(input)
