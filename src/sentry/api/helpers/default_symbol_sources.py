from sentry.models.project import Project
from sentry.projects.services.project import RpcProject

DEFAULT_SYMBOL_SOURCES = {
    "electron": ["ios", "microsoft", "electron"],
    "javascript-electron": ["ios", "microsoft", "electron"],
    "unity": ["ios", "microsoft", "android", "nuget", "unity", "nvidia", "ubuntu"],
    "unreal": ["ios", "microsoft", "android", "nvidia", "ubuntu"],
    "godot": ["ios", "microsoft", "android", "nuget", "nvidia", "ubuntu"],
}


def set_default_symbol_sources(project: Project | RpcProject):
    if project.platform and project.platform in DEFAULT_SYMBOL_SOURCES:
        project.update_option(
            "sentry:builtin_symbol_sources", DEFAULT_SYMBOL_SOURCES[project.platform]
        )
