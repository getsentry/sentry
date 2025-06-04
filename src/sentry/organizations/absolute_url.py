from __future__ import annotations

import re
from urllib.parse import urlparse

from sentry import features, options
from sentry.app import env
from sentry.utils.http import absolute_uri, is_using_customer_domain

_path_patterns: list[tuple[re.Pattern[str], str]] = [
    # /organizations/slug/section, but not /organizations/new
    (re.compile(r"\/?organizations\/(?!new)[^\/]+\/(.*)"), r"/\1"),
    # For /settings/:orgId/ -> /settings/organization/
    (
        re.compile(r"\/settings\/(?!account\/|!billing\/|projects\/|teams)[^\/]+\/?$"),
        "/settings/organization/",
    ),
    # Move /settings/:orgId/:section -> /settings/:section
    # but not /settings/organization or /settings/projects which is a new URL
    (
        re.compile(r"^\/?settings\/(?!account\/|billing\/|projects\/|teams)[^\/]+\/(.*)"),
        r"/settings/\1",
    ),
    (re.compile(r"^\/?join-request\/[^\/]+\/?.*"), r"/join-request/"),
    (re.compile(r"^\/?onboarding\/[^\/]+\/(.*)"), r"/onboarding/\1"),
    (
        re.compile(r"^\/?(?!settings)[^\/]+\/([^\/]+)\/getting-started\/(.*)"),
        r"/getting-started/\1/\2",
    ),
]


def customer_domain_path(path: str) -> str:
    """
    Server side companion to path normalizations found in withDomainRequired
    """
    for pattern, replacement in _path_patterns:
        updated = pattern.sub(replacement, path)
        if updated != path:
            return updated
    return path


def _generate_organization_hostname(org_slug: str) -> str:
    url_prefix_hostname: str = urlparse(options.get("system.url-prefix")).netloc
    org_base_hostname_template: str = options.get("system.organization-base-hostname")
    if not org_base_hostname_template:
        return url_prefix_hostname
    has_org_slug_placeholder = "{slug}" in org_base_hostname_template
    if not has_org_slug_placeholder:
        return url_prefix_hostname
    org_hostname = org_base_hostname_template.replace("{slug}", org_slug)
    return org_hostname


def generate_organization_url(org_slug: str) -> str:
    org_url_template: str = options.get("system.organization-url-template")
    if not org_url_template:
        return options.get("system.url-prefix")
    return org_url_template.replace("{hostname}", _generate_organization_hostname(org_slug))


def has_customer_domain() -> bool:
    return (
        # XXX: this accesses a sneaky global
        (env.request is not None and is_using_customer_domain(env.request))
        or features.has("system:multi-region")
    )


def organization_absolute_url(
    *,
    has_customer_domain: bool,
    slug: str,
    path: str,
    query: str | None = None,
    fragment: str | None = None,
) -> str:
    """
    Get an absolute URL to `path` for this organization.

    This method takes customer-domains into account and will update the path when
    customer-domains are active.
    """
    url_base = None
    if has_customer_domain:
        path = customer_domain_path(path)
        url_base = generate_organization_url(slug)
    uri = absolute_uri(path, url_prefix=url_base)
    parts = [uri]
    if query and not query.startswith("?"):
        query = f"?{query}"
    if query:
        parts.append(query)
    if fragment and not fragment.startswith("#"):
        fragment = f"#{fragment}"
    if fragment:
        parts.append(fragment)
    return "".join(parts)
