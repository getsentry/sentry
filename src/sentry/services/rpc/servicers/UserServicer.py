import logging

from sentry.models.user import User
from sentry.services.rpc.protobufs import User_pb2, User_pb2_grpc

logger = logging.getLogger(__name__)


class UserModelInterface:
    @classmethod
    def change_name(self, item_id, name):
        user = User.objects.get(id=item_id)
        user.username = name
        user.save()
        return user  # as dataclass


class UserServicer(User_pb2_grpc.UserServiceServicer):
    def ChangeName(self, request, context):
        user = UserModelInterface.change_name(request.item_id, request.name)
        logger.info(
            f"Sucessfully updated user via request: item_id={request.item_id} request.name={request.name}"
        )
        response = User_pb2.User(id=user.id, name=user.username)
        return response
