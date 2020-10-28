# Orignal version taken from http://www.djangosnippets.org/snippets/186/
# Original author: udfalkso
# Modified by: Shwagroo Team and Gun.io
from __future__ import absolute_import

import cProfile
import re
import pstats
import six
import sys

from django.conf import settings
from django.http import HttpResponse
from six import StringIO

from sentry.auth.superuser import is_active_superuser

words_re = re.compile(r"\s+")

group_prefix_re = [
    re.compile(r"^.*/django/[^/]+"),
    re.compile(r"^(.*)/[^/]+$"),  # extract module path
    re.compile(r".*"),  # catch strange entries
]


class ProfileMiddleware(object):
    """
    Displays hotshot profiling for any view.
    http://yoursite.com/yourview/?prof

    Add the "prof" key to query string by appending ?prof (or &prof=)
    and you'll see the profiling results in your browser.
    It's set up to only be available in django's debug mode, is available for superuser otherwise,
    but you really shouldn't add this middleware to any production configuration.

    WARNING: It uses hotshot profiler which is not thread safe.
    """

    def can(self, request):
        if "prof" not in request.GET:
            return False
        if settings.DEBUG:
            return True
        if is_active_superuser(request):
            return True
        return False

    def process_view(self, request, callback, callback_args, callback_kwargs):
        if not self.can(request):
            return
        self.prof = cProfile.Profile()

        return self.prof.runcall(callback, request, *callback_args, **callback_kwargs)

    def get_group(self, filename):
        for g in group_prefix_re:
            name = g.findall(filename)
            if name:
                return name[0]

    def get_summary(self, results_dict, total):
        results = [(item[1], item[0]) for item in six.iteritems(results_dict)]
        results.sort(reverse=True)
        results = results[:40]

        res = "      tottime\n"
        for item in results:
            res += "%4.1f%% %7.3f %s\n" % (100 * item[0] / total if total else 0, item[0], item[1])

        return res

    def normalize_paths(self, stats):
        import os.path
        from pstats import add_func_stats, func_std_string

        python_paths = sorted(sys.path, reverse=True)

        def rel_filename(filename):
            for path in python_paths:
                if filename.startswith(path):
                    return filename[len(path) + 1 :]
            return os.path.basename(filename)

        def func_strip_path(func_name):
            filename, line, name = func_name
            return rel_filename(filename), line, name

        oldstats = stats.stats
        stats.stats = newstats = {}
        max_name_len = 0
        for func, (cc, nc, tt, ct, callers) in six.iteritems(oldstats):
            newfunc = func_strip_path(func)
            if len(func_std_string(newfunc)) > max_name_len:
                max_name_len = len(func_std_string(newfunc))
            newcallers = {}
            for func2, caller in six.iteritems(callers):
                newcallers[func_strip_path(func2)] = caller

            if newfunc in newstats:
                newstats[newfunc] = add_func_stats(newstats[newfunc], (cc, nc, tt, ct, newcallers))
            else:
                newstats[newfunc] = (cc, nc, tt, ct, newcallers)
        old_top = stats.top_level
        stats.top_level = new_top = {}
        for func in old_top:
            new_top[func_strip_path(func)] = None

        stats.max_name_len = max_name_len

        stats.fcn_list = None
        stats.all_callees = None
        return self

    def summary_for_files(self, stats_str):
        stats_str = stats_str.split("\n")[5:]

        mystats = {}
        mygroups = {}

        total = 0

        for s in stats_str:
            fields = words_re.split(s)
            if len(fields) == 7:
                time = float(fields[2])
                total += time
                filename = fields[6].split(":")[0]

                if filename not in mystats:
                    mystats[filename] = 0
                mystats[filename] += time

                group = self.get_group(filename)
                if group not in mygroups:
                    mygroups[group] = 0
                mygroups[group] += time

        return (
            "\n"
            + " ---- By file ----\n\n"
            + self.get_summary(mystats, total)
            + "\n"
            + " ---- By group ---\n\n"
            + self.get_summary(mygroups, total)
            + "\n"
        )

    def process_response(self, request, response):
        if not self.can(request):
            return response

        out = StringIO.StringIO()
        old_stdout = sys.stdout
        sys.stdout = out

        stats = pstats.Stats(self.prof)
        self.normalize_paths(stats)
        stats.sort_stats("time", "calls")
        stats.print_stats()

        sys.stdout = old_stdout
        stats_str = out.getvalue()

        content = "\n".join(stats_str.split("\n")[:40])
        content += "\n\n"
        content += self.summary_for_files(stats_str)

        return HttpResponse(content, "text/plain")
