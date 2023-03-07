from rest_framework.request import Request

from sentry.types.activity import ActivityType

from .mail import ActivityMailDebugView, get_random, make_message


class DebugNoteEmailView(ActivityMailDebugView):
    def get_activity(self, request: Request, event):
        random = get_random(request)
        return {
            "type": ActivityType.NOTE.value,
            "user_id": request.user.id,
            "data": {"text": make_message(random, max(2, int(random.weibullvariate(12, 0.4))))},
        }
