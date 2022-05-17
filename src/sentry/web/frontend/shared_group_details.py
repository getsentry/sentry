from rest_framework.request import Request

from sentry.models import Group
from sentry.web.frontend.react_page import GenericReactPageView


class SharedGroupDetailsView(GenericReactPageView):
    def meta_tags(self, request: Request, share_id):
        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            return {}
        if group.organization.flags.disable_shared_issues:
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
