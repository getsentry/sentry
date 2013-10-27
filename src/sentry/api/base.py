from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from rest_framework.views import APIView

from .authentication import KeyAuthentication
from .permissions import HasProjectPermission


class BaseView(APIView):
    authentication_classes = (KeyAuthentication, SessionAuthentication)
    permission_classes = (HasProjectPermission,)
    parser_classes = (JSONParser,)
