from __future__ import annotations

from functools import cached_property

from django.db import models

from sentry.organizations.absolute_url import has_customer_domain, organization_absolute_url


class OrganizationAbsoluteUrlMixin:
    slug: str | models.Field[str, str]

    @cached_property
    def __has_customer_domain(self) -> bool:
        """
        Check if the current organization is using or has access to customer domains.
        """
        return has_customer_domain()

    def _has_customer_domain(self) -> bool:
        # For getsentry compatibility
        return self.__has_customer_domain

    def absolute_url(self, path: str, query: str | None = None, fragment: str | None = None) -> str:
        """
        Get an absolute URL to `path` for this organization.

        This method takes customer-domains into account and will update the path when
        customer-domains are active.
        """
        return organization_absolute_url(
            has_customer_domain=self.__has_customer_domain,
            slug=self.slug,
            path=path,
            query=query,
            fragment=fragment,
        )
