from __future__ import absolute_import, unicode_literals

from django.template import Context, Template
from django.utils.translation import ugettext_lazy as _
from time import time

from .base import CallRecordingPanel
from ..utils.function_wrapper import FunctionWrapper
from ..utils.patch_context import PatchContext

TEMPLATE = Template("""
{% load i18n %}
<h4>{% trans "Requests" %}</h4>
<table>
    <thead>
        <tr>
            <th>{% trans "Duration" %}</th>
            <th>{% trans "Command" %}</th>
            <th>{% trans "Args" %}</th>
        </tr>
    </thead>
    <tbody>
        {% for call in calls %}
        <tr>
            <td>{{ call.duration }} ms</td>
            <td>{{ call.command }}</td>
            <td>{{ call.args }} {{ call.kwargs }}</td>
        </tr>
        {% endfor %}
    </tbody>
</table>
""")


class RedisPipelineWrapper(FunctionWrapper):
    def __call__(self, func, pipeline, *args, **kwargs):
        __traceback_hide__ = True  # NOQA

        command_stack = pipeline.command_stack[:]

        start = time()
        try:
            return func(pipeline, *args, **kwargs)
        finally:
            end = time()

            data = {
                'name': 'pipeline',
                'args': repr(command_stack),
                'kwargs': repr({}),
                'start': start,
                'end': end,
            }

            self.record(data)


class RedisWrapper(FunctionWrapper):
    def __call__(self, func, *args, **kwargs):
        __traceback_hide__ = True  # NOQA

        start = time()
        try:
            return func(*args, **kwargs)
        finally:
            end = time()

            data = {
                'name': args[1],
                'args': repr(args[2:]),
                'kwargs': repr(kwargs),
                'start': start,
                'end': end,
            }
            self.record(data)


class RedisPanel(CallRecordingPanel):
    title = nav_title = _("Redis")

    @classmethod
    def get_context(cls, collector):
        return [
            PatchContext('redis.client.StrictRedis.execute_command', RedisWrapper(collector)),
            PatchContext('redis.client.BasePipeline.execute', RedisPipelineWrapper(collector)),
        ]

    @property
    def content(self):
        stats = self.get_stats()
        return TEMPLATE.render(Context(stats))

    def process_response(self, request, response):
        calls = []
        total_time = 0
        for call in self.calls:
            duration = int((call['end'] - call['start']) * 1000)

            total_time += duration
            calls.append({
                'duration': duration,
                'command': call['name'],
                'args': call['args'],
                'kwargs': call['kwargs'],
            })

        self.record_stats({
            'calls': calls,
            'total_time': total_time,
        })
