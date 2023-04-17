import sentry_sdk
from symbolic import ProguardMapper, SourceView

from sentry.lang.java.processing import deobfuscate_exception_value
from sentry.lang.java.utils import (
    deobfuscate_view_hierarchy,
    get_jvm_images,
    get_proguard_images,
    has_proguard_file,
)
from sentry.lang.javascript.processor import get_source_context, trim_line
from sentry.models import ArtifactBundleArchive, EventError, ProjectDebugFile
from sentry.plugins.base.v2 import Plugin2
from sentry.reprocessing import report_processing_issue
from sentry.stacktraces.processing import StacktraceProcessor


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


# A processor that delegates to JavaStacktraceProcessor for restoring code
# obfuscated by ProGuard or similar. It then tries to look up source context
# for either the de-obfuscated stack frame or the stack frame that was passed in.
class JavaSourceLookupStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)
        self.proguard_processor = JavaStacktraceProcessor(*args, **kwargs)
        self._proguard_processor_handles_frame = None
        self._handles_frame = None
        self.images = get_jvm_images(self.data)
        self._archives = []
        self.available = len(self.images) > 0

    def close(self):
        for archive in self._archives:
            archive.close()

    def handles_frame(self, frame, stacktrace_info):
        self._proguard_processor_handles_frame = self.proguard_processor.handles_frame(
            frame, stacktrace_info
        )

        platform = frame.get("platform") or self.data.get("platform")
        self._handles_frame = platform == "java" and self.available and "module" in frame
        return self._proguard_processor_handles_frame or self._handles_frame

    def preprocess_step(self, processing_task):
        proguard_processor_preprocess_rv = False
        if self._proguard_processor_handles_frame:
            proguard_processor_preprocess_rv = self.proguard_processor.preprocess_step(
                processing_task
            )

        if not self.available:
            return proguard_processor_preprocess_rv

        difs = ProjectDebugFile.objects.find_by_debug_ids(self.project, self.images)
        for key, dif in difs.items():
            try:
                file = dif.file.getfile(prefetch=True)
                self._archives.append(ArtifactBundleArchive(file))
            except Exception:
                pass

        return proguard_processor_preprocess_rv or self.available

    def process_exception(self, exception):
        if self._proguard_processor_handles_frame:
            return self.proguard_processor.process_exception(exception)
        return False

    # if path contains a $ sign it has most likely been obfuscated
    def _is_valid_path(self, abs_path):
        if abs_path is None:
            return False
        abs_path_dollar_index = abs_path.find("$")
        return abs_path_dollar_index < 0

    def _build_source_file_name(self, frame):
        abs_path = frame.get("abs_path")
        module = frame["module"]

        if self._is_valid_path(abs_path):
            # extract package from module (io.sentry.Sentry -> io.sentry) and append abs_path
            module_dot_index = module.rfind(".")
            if module_dot_index >= 0:
                source_file_name = module[:module_dot_index].replace(".", "/") + "/"
            else:
                source_file_name = ""

            abs_path_dot_index = abs_path.rfind(".")
            if abs_path_dot_index >= 0:
                source_file_name += abs_path[:abs_path_dot_index]
            else:
                source_file_name += abs_path
        else:
            # use module as filename (excluding inner classes, marked by $) and append .java
            module_dollar_index = module.find("$")
            if module_dollar_index >= 0:
                source_file_name = module[:module_dollar_index].replace(".", "/")
            else:
                source_file_name = module.replace(".", "/")

        source_file_name += (
            ".jvm"  # fake extension because we don't know whether it's .java, .kt or something else
        )

        return "~/" + source_file_name

    def process_frame(self, processable_frame, processing_task):
        new_frames = None
        raw_frames = None
        processing_errors = None

        if self._proguard_processor_handles_frame:
            proguard_result = self.proguard_processor.process_frame(
                processable_frame, processing_task
            )

            if proguard_result:
                new_frames, raw_frames, processing_errors = proguard_result

        if not self._handles_frame:
            return new_frames, raw_frames, processing_errors

        if not new_frames:
            new_frames = [dict(processable_frame.frame)]

        for new_frame in new_frames:
            lineno = new_frame.get("lineno")
            if not lineno:
                continue

            source_file_name = self._build_source_file_name(new_frame)

            for archive in self._archives:
                try:
                    result, _ = archive.get_file_by_url(source_file_name)
                    source_view = SourceView.from_bytes(result.read())
                    source_context = get_source_context(source_view, lineno)

                    (pre_context, context_line, post_context) = source_context

                    if pre_context is not None and len(pre_context) > 0:
                        new_frame["pre_context"] = [trim_line(x) for x in pre_context]
                    if context_line is not None:
                        new_frame["context_line"] = trim_line(context_line)
                    if post_context is not None and len(post_context) > 0:
                        new_frame["post_context"] = [trim_line(x) for x in post_context]
                except KeyError:
                    # file not available in source bundle, proceed
                    pass

        return new_frames, raw_frames, processing_errors


class JavaPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if "java" in platforms:
            return [JavaSourceLookupStacktraceProcessor]

    def get_event_preprocessors(self, data):
        if has_proguard_file(data):
            return [deobfuscate_exception_value, deobfuscate_view_hierarchy]
