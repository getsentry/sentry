from __future__ import absolute_import

from django.contrib.admindocs.views import simplify_regex
from django.http import Http404
from django.utils.importlib import import_module

from sentry.api.base import DocSection, Endpoint
from sentry.constants import HTTP_METHODS
from sentry.web.helpers import render_to_response
from sentry.web.frontend.base import BaseView


class ApiHelpSectionView(BaseView):
    auth_required = False

    def get(self, request, section_id):
        try:
            section = DocSection[section_id.upper()]
        except KeyError:
            raise Http404

        context = {
            'section': {
                'id': section.name.lower(),
                'name': section.value,
            },
            'resource_list': self.get_resources(section)
        }

        return render_to_response('sentry/help/api_section.html', context, request)

    def get_resources(self, section, prefix='/api/0/'):
        urls = import_module('sentry.api.urls')

        resources = []
        for pattern in urls.urlpatterns:
            callback = self.__get_resource_callback(pattern, prefix)
            if callback is None:
                continue
            if getattr(callback, 'doc_section', None) != section:
                continue
            data = self.__get_resource_data(pattern, prefix, callback)
            resources.append(data)
        return sorted(resources, key=lambda x: x['path'])

    def __strip_doc(self, doc):
        return doc.strip()

    def __split_doc(self, doc, path):
        if doc:
            try:
                title, doc = doc.split('\n', 1)
            except ValueError:
                title, doc = doc, ''
        else:
            title = path

        return title.strip(), doc.strip()

    def __get_resource_callback(self, pattern, prefix):
        if not hasattr(pattern, 'callback'):
            return

        if hasattr(pattern.callback, 'cls'):
            callback = pattern.callback.cls

            if not issubclass(callback, Endpoint):
                return
        elif hasattr(pattern.callback, 'cls_instance'):
            callback = pattern.callback.cls_instance

            if not isinstance(callback, Endpoint):
                return
        else:
            return

        return callback

    def __get_resource_data(self, pattern, prefix, callback):
        path = simplify_regex(pattern.regex.pattern)

        path = path.replace('<', '{').replace('>', '}')

        methods = []
        for method_name in HTTP_METHODS:
            if method_name == 'OPTIONS':
                continue
            method = getattr(callback, method_name.lower(), None)
            if method is None:
                continue
            methods.append({
                'name': method_name,
                'doc': self.__strip_doc(method.__doc__ or ''),
            })

        title, docstring = self.__split_doc(
            self.__strip_doc(callback.__doc__ or ''), path=path)

        return {
            'path': prefix.rstrip('/') + path,
            'methods': methods,
            'doc': docstring,
            'title': title,
            'section': getattr(callback, 'doc_section', None),
        }
