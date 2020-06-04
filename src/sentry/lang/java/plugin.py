from __future__ import absolute_import

import six

from symbolic import ProguardMapper
from sentry.plugins.base.v2 import Plugin2
from sentry.stacktraces.processing import StacktraceProcessor
from sentry.models import ProjectDebugFile, EventError
from sentry.reprocessing import report_processing_issue
from sentry.utils.safe import get_path
from sentry.utils.compat import map


def is_valid_image(image):
    return bool(image) and image.get("type") == "proguard" and image.get("uuid") is not None


def map_frame(raw_frame, new_frame):
    frame = dict(raw_frame)
    frame["module"] = new_frame.class_name
    frame["function"] = new_frame.method
    frame["lineno"] = new_frame.line
    if new_frame.file is None:
        frame.pop("filename", None)
        frame.pop("abs_path", None)

    return frame


class JavaStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.images = set()
        self.available = False

        for image in get_path(self.data, "debug_meta", "images", filter=is_valid_image, default=()):
            self.available = True
            self.images.add(six.text_type(image["uuid"]).lower())

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get("platform") or self.data.get("platform")
        return platform == "java" and self.available and "function" in frame and "module" in frame

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

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

        key = "%s.%s" % (mod, ty)

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

        for view in self.mapping_views:
            mapped = view.remap_frame(frame["module"], frame["function"], frame.get("lineno") or 0)
            mapped = map(lambda f: map_frame(frame, f), mapped)

            if len(mapped) > 0:
                # sentry expects stack traces in reverse order
                return reversed(mapped), [raw_frame], []

        return


class JavaPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if "java" in platforms:
            return [JavaStacktraceProcessor]
