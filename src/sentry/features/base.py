from __future__ import absolute_import

__all__ = ["Feature", "OrganizationFeature", "ProjectFeature", "ProjectPluginFeature"]


class Feature(object):
    def __init__(self, name):
        self.name = name
        self.entity_type = "feature"


class OrganizationFeature(Feature):
    def __init__(self, name, organization):
        Feature.__init__(self, name)
        self.organization = organization
        self.entity_type = "organization_feature"


class ProjectFeature(Feature):
    def __init__(self, name, project):
        Feature.__init__(self, name)
        self.project = project
        self.entity_type = "project_feature"


class ProjectPluginFeature(ProjectFeature):
    def __init__(self, name, project, plugin):
        ProjectFeature.__init__(self, name, project)
        self.plugin = plugin
        self.entity_type = "project_plugin_feature"
