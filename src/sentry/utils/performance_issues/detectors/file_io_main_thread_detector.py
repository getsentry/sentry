from __future__ import annotations

import hashlib
import os
from collections import defaultdict

from symbolic import ProguardMapper  # type: ignore

from sentry import features
from sentry.issues.grouptype import PerformanceFileIOMainThreadGroupType
from sentry.models import Organization, Project, ProjectDebugFile

from ..base import DetectorType, PerformanceDetector, total_span_time
from ..performance_problem import PerformanceProblem
from ..types import Span


class FileIOMainThreadDetector(PerformanceDetector):
    """
    Checks for a file io span on the main thread
    """

    __slots__ = ("spans_involved", "stored_problems")

    IGNORED_EXTENSIONS = {".nib", ".plist"}
    type: DetectorType = DetectorType.FILE_IO_MAIN_THREAD
    settings_key = DetectorType.FILE_IO_MAIN_THREAD

    def init(self):
        self.spans_involved = {}
        self.most_recent_start_time = {}
        self.most_recent_hash = {}
        self.stored_problems = {}
        self.mapper = None
        self.parent_to_blocked_span = defaultdict(list)
        self._prepare_deobfuscation()

    def _prepare_deobfuscation(self):
        event = self._event
        if "debug_meta" in event:
            images = event["debug_meta"].get("images", [])
            project_id = event.get("project")
            if not isinstance(images, list):
                return
            if project_id is not None:
                project = Project.objects.get_from_cache(id=project_id)
            else:
                return

            for image in images:
                if image.get("type") == "proguard":
                    uuid = image.get("uuid")
                    dif_paths = ProjectDebugFile.difcache.fetch_difs(
                        project, [uuid], features=["mapping"]
                    )
                    debug_file_path = dif_paths.get(uuid)
                    if debug_file_path is None:
                        return

                    mapper = ProguardMapper.open(debug_file_path)
                    if not mapper.has_line_info:
                        return
                    self.mapper = mapper
                    return

    def _deobfuscate_module(self, module: str) -> str:
        if self.mapper is not None:
            return self.mapper.remap_class(module)
        else:
            return module

    def _deobfuscate_function(self, frame):
        if self.mapper is not None and "module" in frame and "function" in frame:
            functions = self.mapper.remap_frame(
                frame["module"], frame["function"], frame.get("lineno") or 0
            )
            return ".".join([func.method for func in functions])
        else:
            return frame.get("function", "")

    def visit_span(self, span: Span):
        if self._is_file_io_on_main_thread(span):
            parent_span_id = span.get("parent_span_id")
            self.parent_to_blocked_span[parent_span_id].append(span)

    def on_complete(self):
        for parent_span_id, span_list in self.parent_to_blocked_span.items():
            span_list = [
                span for span in span_list if "start_timestamp" in span and "timestamp" in span
            ]
            total_duration = total_span_time(span_list)
            settings_for_span = self.settings_for_span(span_list[0])
            if not settings_for_span:
                return

            _, _, _, _, settings = settings_for_span
            if total_duration >= settings["duration_threshold"]:
                fingerprint = self._fingerprint(span_list)
                self.stored_problems[fingerprint] = PerformanceProblem(
                    fingerprint=fingerprint,
                    op=span_list[0].get("op"),
                    desc=span_list[0].get("description", ""),
                    parent_span_ids=[parent_span_id],
                    type=PerformanceFileIOMainThreadGroupType,
                    cause_span_ids=[],
                    offender_span_ids=[span["span_id"] for span in span_list if "span_id" in span],
                )

    def _fingerprint(self, span_list) -> str:
        call_stack_strings = []
        overall_stack = []
        for span in span_list:
            for item in span.get("data", {}).get("call_stack", []):
                module = self._deobfuscate_module(item.get("module", ""))
                function = self._deobfuscate_function(item)
                call_stack_strings.append(f"{module}.{function}")
            # Use set to remove dupes, and list index to preserve order
            overall_stack.append(
                ".".join(sorted(set(call_stack_strings), key=lambda c: call_stack_strings.index(c)))
            )
        call_stack = "-".join(
            sorted(set(overall_stack), key=lambda s: overall_stack.index(s))
        ).encode("utf8")
        hashed_stack = hashlib.sha1(call_stack).hexdigest()
        return f"1-{PerformanceFileIOMainThreadGroupType.type_id}-{hashed_stack}"

    def _is_file_io_on_main_thread(self, span: Span) -> bool:
        data = span.get("data", {})
        if data is None:
            return False
        _, fileext = os.path.splitext(data.get("file.path", ""))
        if fileext in self.IGNORED_EXTENSIONS:
            return False
        # doing is True since the value can be any type
        return data.get("blocked_main_thread", False) is True

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-file-io-main-thread-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True
