from __future__ import annotations

from functools import cached_property
from typing import Optional

from django.db import models

from sentry import features
from sentry.app import env
from sentry.utils.http import is_using_customer_domain


class OrganizationAbsoluteUrlMixin:
    slug: str | models.Field[str, str]

    @cached_property
    def __has_customer_domain(self) -> bool:
        """
        Check if the current organization is using or has access to customer domains.
        """

        request = env.request
        if request and is_using_customer_domain(request):
            return True

        return features.has("organizations:customer-domains", self)

    def _has_customer_domain(self) -> bool:
        # For getsentry compatibility
        return self.__has_customer_domain

    def absolute_url(
        self, path: str, query: Optional[str] = None, fragment: Optional[str] = None
    ) -> str:
        """
        Get an absolute URL to `path` for this organization.

        This method takes customer-domains into account and will update the path when
        customer-domains are active.
        """
        return self.organization_absolute_url(
            self.__has_customer_domain, self.slug, path=path, query=query, fragment=fragment
        )

    @staticmethod
    def organization_absolute_url(
        has_customer_domain: bool,
        slug: str,
        path: str,
        query: Optional[str] = None,
        fragment: Optional[str] = None,
    ) -> str:
        """
        Get an absolute URL to `path` for this organization.

        This method takes customer-domains into account and will update the path when
        customer-domains are active.
        """
        # Avoid cycles.
        from sentry.api.utils import customer_domain_path, generate_organization_url
        from sentry.utils.http import absolute_uri

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
