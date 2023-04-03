import logging

import sentry_sdk
from symbolic import ProguardMapper, SourceView

from sentry.lang.java.processing import deobfuscate_exception_value
from sentry.lang.java.utils import (
    deobfuscate_view_hierarchy,
    get_proguard_images,
    get_source_images,
    has_proguard_file,
)
from sentry.models import ArtifactBundleArchive, EventError, ProjectDebugFile
from sentry.plugins.base.v2 import Plugin2
from sentry.reprocessing import report_processing_issue
from sentry.stacktraces.processing import StacktraceProcessor

logger = logging.getLogger()


class JavaStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.images = get_proguard_images(self.data)
        self.available = len(self.images) > 0

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get("platform") or self.data.get("platform")
        return platform == "java" and self.available and "function" in frame and "module" in frame

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        with sentry_sdk.start_span(op="proguard.fetch_debug_files"):
            dif_paths = ProjectDebugFile.difcache.fetch_difs(
                self.project, self.images, features=["mapping"]
            )
            self.mapping_views = []

        for debug_id in self.images:
            error_type = None

            dif_path = dif_paths.get(debug_id)
            if dif_path is None:
                error_type = EventError.PROGUARD_MISSING_MAPPING
            else:
                with sentry_sdk.start_span(op="proguard.open"):
                    view = ProguardMapper.open(dif_path)
                    if not view.has_line_info:
                        error_type = EventError.PROGUARD_MISSING_LINENO
                    else:
                        self.mapping_views.append(view)

            if error_type is None:
                continue

            self.data.setdefault("_metrics", {})["flag.processing.error"] = True

            self.data.setdefault("errors", []).append(
                {"type": error_type, "mapping_uuid": debug_id}
            )

            report_processing_issue(
                self.data,
                scope="proguard",
                object="mapping:%s" % debug_id,
                type=error_type,
                data={"mapping_uuid": debug_id},
            )

        return True

    def process_exception(self, exception):
        ty = exception.get("type")
        mod = exception.get("module")
        if not ty or not mod:
            return False

        key = f"{mod}.{ty}"

        for view in self.mapping_views:
            mapped = view.remap_class(key)
            if mapped:
                new_module, new_cls = mapped.rsplit(".", 1)
                exception["module"] = new_module
                exception["type"] = new_cls
                return True

        return False

    def process_frame(self, processable_frame, processing_task):
        frame = processable_frame.frame
        raw_frame = dict(frame)

        # first, try to remap complete frames
        for view in self.mapping_views:
            mapped = view.remap_frame(frame["module"], frame["function"], frame.get("lineno") or 0)

            if len(mapped) > 0:
                new_frames = []
                bottom_class = mapped[-1].class_name

                # sentry expects stack traces in reverse order
                for new_frame in reversed(mapped):
                    frame = dict(raw_frame)
                    frame["module"] = new_frame.class_name
                    frame["function"] = new_frame.method
                    frame["lineno"] = new_frame.line

                    # clear the filename for all *foreign* classes
                    if frame["module"] != bottom_class:
                        frame.pop("filename", None)
                        frame.pop("abs_path", None)

                    new_frames.append(frame)

                return new_frames, [raw_frame], []

        # second, if that is not possible, try to re-map only the class-name
        for view in self.mapping_views:
            mapped = view.remap_class(frame["module"])

            if mapped:
                new_frame = dict(raw_frame)
                new_frame["module"] = mapped
                return [new_frame], [raw_frame], []

        return


def trim_line(line, column=0):
    """
    Trims a line down to a goal of 140 characters, with a little
    wiggle room to be sensible and tries to trim around the given
    `column`. So it tries to extract 60 characters before and after
    the provided `column` and yield a better context.
    """
    line = line.strip("\n")
    ll = len(line)
    if ll <= 150:
        return line
    if column > ll:
        column = ll
    start = max(column - 60, 0)
    # Round down if it brings us close to the edge
    if start < 5:
        start = 0
    end = min(start + 140, ll)
    # Round up to the end if it's close
    if end > ll - 5:
        end = ll
    # If we are bumped all the way to the end,
    # make sure we still get a full 140 characters in the line
    if end == ll:
        start = max(end - 140, 0)
    line = line[start:end]
    if end < ll:
        # we've snipped from the end
        line += " {snip}"
    if start > 0:
        # we've snipped from the beginning
        line = "{snip} " + line
    return line


def get_source_context(source, lineno, context=5):
    if not source:
        return None, None, None

    # lineno's in JS are 1-indexed
    # just in case. sometimes math is hard
    if lineno > 0:
        lineno -= 1
    else:
        return None, None, None

    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = source[lower_bound:lineno]
    except IndexError:
        pre_context = []

    try:
        context_line = source[lineno]
    except IndexError:
        context_line = ""

    try:
        post_context = source[(lineno + 1) : upper_bound]
    except IndexError:
        post_context = []

    return pre_context or None, context_line, post_context or None


class JavaSourceLookupStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.images = get_source_images(self.data)
        logger.warning(f"images lookup: ({self.images})")
        self.available = len(self.images) > 0

    def handles_frame(self, frame, stacktrace_info):
        # platform = frame.get("platform") or self.data.get("platform")
        return self.available and "abs_path" in frame and "module" in frame and "lineno" in frame

    def preprocess_step(self, processing_task):
        return self.available

    def process_exception(self, exception):
        return False

    # if path contains a $ sign it has most likely been obfuscated
    def _is_valid_path(self, abs_path):
        abs_path_dollar_index = abs_path.rfind("$")
        return abs_path_dollar_index < 0

    def _build_source_file_name(self, frame):
        abs_path = frame["abs_path"]
        module = frame["module"]

        if self._is_valid_path(abs_path):
            # extract package from module (io.sentry.Sentry -> io.sentry) and append abs_path
            module_dot_index = module.rfind(".")
            if module_dot_index >= 0:
                source_file_name = module[:module_dot_index].replace(".", "/") + "/"
            else:
                source_file_name = ""
            source_file_name += abs_path
        else:
            # use module as filename (excluding inner classes, marked by $) and append .java
            module_dollar_index = module.rfind("$")
            if module_dollar_index >= 0:
                source_file_name = module[:module_dollar_index].replace(".", "/")
            else:
                source_file_name = module.replace(".", "/")
            source_file_name += ".java"

        return "~/" + source_file_name

    def process_frame(self, processable_frame, processing_task):
        frame = processable_frame.frame
        new_frame = dict(frame)
        raw_frame = dict(frame)
        # TODO could be undefined but inApp later
        in_app = raw_frame.get("in_app", False)
        if not in_app:
            return

        logger.warning(f"raw frame: ({raw_frame})")
        lineno = raw_frame["lineno"]

        source_file_name = self._build_source_file_name(raw_frame)
        logger.warning(f"source_file_name ({source_file_name})")

        # TODO unable to use dif cache as file can't be recognized as ZIP by ArtifactBundleArchive(file)
        difs = ProjectDebugFile.objects.find_by_debug_ids(self.project, self.images)

        for key, dif in difs.items():
            file = dif.file.getfile(prefetch=True)
            archive = ArtifactBundleArchive(file)
            try:
                result, _ = archive.get_file_by_url(source_file_name)
                source_view = SourceView.from_bytes(result.read())
                source_context = get_source_context(source_view, lineno)

                (pre_context, context_line, post_context) = source_context

                if pre_context is not None and len(pre_context) > 0:
                    new_frame["pre_context"] = [trim_line(x) for x in pre_context]
                if context_line is not None:
                    new_frame["context_line"] = trim_line(context_line, new_frame.get("colno") or 0)
                if post_context is not None and len(post_context) > 0:
                    new_frame["post_context"] = [trim_line(x) for x in post_context]
            except KeyError:
                # file not available in source bundle, proceed
                pass
            finally:
                archive.close()

        return [new_frame], None, None


class JavaPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if "java" in platforms:
            return [JavaStacktraceProcessor, JavaSourceLookupStacktraceProcessor]

    def get_event_preprocessors(self, data):
        if has_proguard_file(data):
            return [deobfuscate_exception_value, deobfuscate_view_hierarchy]
