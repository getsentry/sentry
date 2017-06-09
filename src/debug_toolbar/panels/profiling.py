from __future__ import absolute_import, division, unicode_literals

from django.utils.translation import ugettext_lazy as _
from django.utils.safestring import mark_safe
from debug_toolbar.panels import Panel
from debug_toolbar import settings as dt_settings

import cProfile
from pstats import Stats
from colorsys import hsv_to_rgb
import os


class DjangoDebugToolbarStats(Stats):
    __root = None

    def get_root_func(self):
        if self.__root is None:
            for func, (cc, nc, tt, ct, callers) in self.stats.items():
                if len(callers) == 0:
                    self.__root = func
                    break
        return self.__root


class FunctionCall(object):
    def __init__(self, statobj, func, depth=0, stats=None,
                 id=0, parent_ids=[], hsv=(0, 0.5, 1)):
        self.statobj = statobj
        self.func = func
        if stats:
            self.stats = stats
        else:
            self.stats = statobj.stats[func][:4]
        self.depth = depth
        self.id = id
        self.parent_ids = parent_ids
        self.hsv = hsv

    def parent_classes(self):
        return self.parent_classes

    def background(self):
        r, g, b = hsv_to_rgb(*self.hsv)
        return 'rgb(%f%%,%f%%,%f%%)' % (r * 100, g * 100, b * 100)

    def func_std_string(self):  # match what old profile produced
        func_name = self.func
        if func_name[:2] == ('~', 0):
            # special case for built-in functions
            name = func_name[2]
            if name.startswith('<') and name.endswith('>'):
                return '{%s}' % name[1:-1]
            else:
                return name
        else:
            file_name, line_num, method = self.func
            idx = file_name.find('/site-packages/')
            if idx > -1:
                file_name = file_name[(idx + 14):]

            file_path, file_name = file_name.rsplit(os.sep, 1)

            return mark_safe(
                '<span class="djdt-path">{0}/</span>'
                '<span class="djdt-file">{1}</span>'
                ' in <span class="djdt-func">{3}</span>'
                '(<span class="djdt-lineno">{2}</span>)'.format(
                    file_path,
                    file_name,
                    line_num,
                    method))

    def subfuncs(self):
        i = 0
        h, s, v = self.hsv
        count = len(self.statobj.all_callees[self.func])
        for func, stats in self.statobj.all_callees[self.func].items():
            i += 1
            h1 = h + (i / count) / (self.depth + 1)
            if stats[3] == 0:
                s1 = 0
            else:
                s1 = s * (stats[3] / self.stats[3])
            yield FunctionCall(self.statobj,
                               func,
                               self.depth + 1,
                               stats=stats,
                               id=str(self.id) + '_' + str(i),
                               parent_ids=self.parent_ids + [self.id],
                               hsv=(h1, s1, 1))

    def count(self):
        return self.stats[1]

    def tottime(self):
        return self.stats[2]

    def cumtime(self):
        cc, nc, tt, ct = self.stats
        return self.stats[3]

    def tottime_per_call(self):
        cc, nc, tt, ct = self.stats

        if nc == 0:
            return 0

        return tt / nc

    def cumtime_per_call(self):
        cc, nc, tt, ct = self.stats

        if cc == 0:
            return 0

        return ct / cc

    def indent(self):
        return 16 * self.depth


class ProfilingPanel(Panel):
    """
    Panel that displays profiling information.
    """
    title = _("Profiling")

    template = 'debug_toolbar/panels/profiling.html'

    def process_view(self, request, view_func, view_args, view_kwargs):
        self.profiler = cProfile.Profile()
        args = (request,) + view_args
        return self.profiler.runcall(view_func, *args, **view_kwargs)

    def add_node(self, func_list, func, max_depth, cum_time=0.1):
        func_list.append(func)
        func.has_subfuncs = False
        if func.depth < max_depth:
            for subfunc in func.subfuncs():
                if subfunc.stats[3] >= cum_time:
                    func.has_subfuncs = True
                    self.add_node(func_list, subfunc, max_depth, cum_time=cum_time)

    def process_response(self, request, response):
        if not hasattr(self, 'profiler'):
            return None
        # Could be delayed until the panel content is requested (perf. optim.)
        self.profiler.create_stats()
        self.stats = DjangoDebugToolbarStats(self.profiler)
        self.stats.calc_callees()

        root = FunctionCall(self.stats, self.stats.get_root_func(), depth=0)

        func_list = []
        self.add_node(func_list,
                      root,
                      dt_settings.CONFIG['PROFILER_MAX_DEPTH'],
                      root.stats[3] / 8)

        self.record_stats({'func_list': func_list})
