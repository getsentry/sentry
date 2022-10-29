import logging

from sentry.models.user import User
from sentry.services.rpc.protobufs import User_pb2, User_pb2_grpc

logger = logging.getLogger(__name__)


class UserServicer(User_pb2_grpc.UserServiceServicer):
    def ChangeName(self, request, context):
        user = User.objects.get(id=request.item_id)
        user.username = request.name
        user.save()
        logger.info(
            f"Sucessfully updated user via request: item_id={request.item_id} request.name={request.name}"
        )
        response = User_pb2.User(id=user.id, name=user.username)
        return response
