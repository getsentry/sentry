from rest_framework.request import Request

from sentry import analytics
from sentry.models import Group
from sentry.utils.assets import get_asset_url
from sentry.utils.metatags import get_provider_by_user_agent
from sentry.web.frontend.react_page import GenericReactPageView


class SharedGroupDetailsView(GenericReactPageView):
    def meta_tags(self, request: Request, share_id):
        obj = super().meta_tags(request)
        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            return {}
        if group.organization.flags.disable_shared_issues:
            return {}

        user_agent = request.META.get("HTTP_USER_AGENT")
        provider = None
        if user_agent:
            provider = get_provider_by_user_agent(user_agent)
        if provider:
            analytics.record("metalink.shared.scraped", provider=provider)

        image_url = get_asset_url("sentry", "images/logos/sentry-avatar.png")
        return {
            **obj,
            "og:type": "website",
            "og:title": group.title,
            "og:description": group.message,
            "og:image": image_url,
            "og:site_name": "Sentry",
            "twitter:card": "summary",
            "twitter:site": "@getsentry",
            "twitter:title": group.title,
            "twitter:description": group.message,
            "twitter:image": image_url,
        }
