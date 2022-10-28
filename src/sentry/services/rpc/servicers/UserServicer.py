from sentry.services.rpc.protobufs import User_pb2, User_pb2_grpc


class UserServicer(User_pb2_grpc.UserServiceServicer):
    def ChangeName(self, request, context):
        print("Received the following user req:")
        print(request)
        response = User_pb2.User(id=1, name="testing")
        print("Responding with:")
        print(response)
        return response
