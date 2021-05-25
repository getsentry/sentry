from .react_page import ReactPageView


class DisabledMemberView(ReactPageView):
    def is_member_disabled_from_limit(self, request, organization):
        return False
