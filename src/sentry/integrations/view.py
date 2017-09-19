from __future__ import absolute_import, print_function

__all__ = ['PipelineView']

from django.http import HttpResponseRedirect
from django.views.generic import View


class PipelineView(View):
    def redirect(self, url):
        return HttpResponseRedirect(url)
