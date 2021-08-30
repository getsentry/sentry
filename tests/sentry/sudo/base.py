from django.contrib.auth.models import AnonymousUser, User
from django.test import RequestFactory, TestCase


class StubPasswordBackend:
    """Stub backend

    Always authenticates when the password matches self.password

    """

    password = "stub"

    def authenticate(self, request, username, password):
        if password == self.password:
            return User()


class FooPasswordBackend(StubPasswordBackend):
    password = "foo"


class BaseTestCase(TestCase):
    def setUp(self):
        self.request = self.get("/foo")
        self.request.session = {}
        self.setUser(AnonymousUser())

    def get(self, *args, **kwargs):
        return RequestFactory().get(*args, **kwargs)

    def post(self, *args, **kwargs):
        return RequestFactory().post(*args, **kwargs)

    def setUser(self, user):
        self.user = self.request.user = user

    def login(self, user_class=User):
        user = user_class()
        self.setUser(user)
