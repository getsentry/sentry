from django.conf import settings
from rest_framework.request import Request

from sentry.services.hybrid_cloud.issue.service import issue_service
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.react_page import GenericReactPageView


@control_silo_view
class SharedGroupDetailsView(GenericReactPageView):
    def meta_tags(self, request: Request, share_id):
        org_slug = getattr(request, "subdomain", None)
        if org_slug:
            group = issue_service.get_shared_for_org(slug=org_slug, share_id=share_id)
        else:
            # Backwards compatibility for Self-hosted and single tenants
            group = issue_service.get_shared_for_region(
                region_name=settings.SENTRY_MONOLITH_REGION, share_id=share_id
            )

        if not group:
            return {}
        return {
            "og:type": "website",
            "og:title": group.title,
            "og:description": group.message,
            "og:site_name": "Sentry",
            "twitter:card": "summary",
            "twitter:site": "@getsentry",
            "twitter:title": group.title,
            "twitter:description": group.message,
        }
