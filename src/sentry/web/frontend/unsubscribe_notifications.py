from __future__ import absolute_import
import abc

import six
from django.db import transaction
from django.http import Http404, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry.models import OrganizationMember
from sentry.web.frontend.base import BaseView
from sentry.web.decorators import signed_auth_required


signed_auth_required_m = method_decorator(signed_auth_required)


@six.add_metaclass(abc.ABCMeta)
class UnsubscribeBaseView(BaseView):
    auth_required = False

    @never_cache
    @signed_auth_required_m
    @transaction.atomic
    def handle(self, request, **kwargs):
        if not getattr(request, "user_from_signed_request", False):
            raise Http404

        instance = self.fetch_instance(**kwargs)

        if not OrganizationMember.objects.filter(
            user=request.user, organization=instance.organization
        ).exists():
            raise Http404

        instance_link = self.build_link(instance)

        if request.method == "POST":
            if request.POST.get("op") == "unsubscribe":
                self.unsubscribe(instance, request.user)
            return HttpResponseRedirect(instance_link)

        return self.respond(
            "sentry/unsubscribe-notifications.html",
            {"instance_link": instance_link, "object_type": self.object_type},
        )

    @abc.abstractproperty
    def object_type(self):
        pass

    @abc.abstractproperty
    def fetch_instance(self, **kwargs):
        pass

    @abc.abstractmethod
    def build_link(self, instance):
        pass

    @abc.abstractmethod
    def unsubscribe(self, instance, user):
        pass
