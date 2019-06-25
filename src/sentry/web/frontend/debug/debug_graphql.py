from __future__ import absolute_import

from graphene_django.views import GraphQLView
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View


class DebugGraphQLView(View):

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        request.auth = None
        return GraphQLView.as_view(graphiql=True)(request)
