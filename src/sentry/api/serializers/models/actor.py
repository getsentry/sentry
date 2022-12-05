from sentry.api.serializers import Serializer


class ActorSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        if obj.class_name() == "User":
            actor_type = "user"
            name = obj.get_display_name()
            context = {"email": obj.email}
        elif obj.class_name() == "Team":
            actor_type = "team"
            name = obj.slug
            context = {}
        else:
            raise AssertionError("Invalid type to assign to: %r" % type(obj))

        context.update({"type": actor_type, "id": str(obj.id), "name": name})
        return context
