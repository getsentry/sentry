from sentry.lang.dart.utils import deobfuscate_view_hierarchy, has_dart_symbols_file
from sentry.models.project import Project
from sentry.plugins.base.v2 import Plugin2
from sentry.utils.options import sample_modulo


class DartPlugin(Plugin2):
    """
    This plugin is responsible for Dart specific processing on events or attachments.

    Currently, this plugin is applies deobfuscation for view hierarchies, but
    since we do not have the proper debug files stored in Sentry, this plugin is
    disabled. When we are ready to roll out dart deobfuscation, this plugin should
    be enabled and rolled out through the options system.
    """

    # TODO: This should be removed and it should not be possible to disable the plugin
    # when we are ready to roll out dart deobfuscation.
    enabled = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_event_preprocessors(self, data):
        project = Project.objects.get_from_cache(id=data["project"])
        if not sample_modulo(
            "processing.view-hierarchies-dart-deobfuscation", project.organization.id
        ):
            return []

        if has_dart_symbols_file(data):
            return [deobfuscate_view_hierarchy]
