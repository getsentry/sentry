from sentry.api.serializers import Serializer
from sentry.models import Team, User
from sentry.services.hybrid_cloud.user import APIUser


class ActorSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        if isinstance(obj, User) or isinstance(obj, APIUser):
            actor_type = "user"
            name = obj.get_display_name()
            context = {"email": obj.email}
        elif isinstance(obj, Team):
            actor_type = "team"
            name = obj.slug
            context = {}
        else:
            raise AssertionError("Invalid type to assign to: %r" % type(obj))

        context.update({"type": actor_type, "id": str(obj.id), "name": name})
        return context
