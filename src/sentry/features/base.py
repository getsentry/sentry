__all__ = ["Feature", "OrganizationFeature", "ProjectFeature", "ProjectPluginFeature"]


class Feature:
    def __init__(self, name):
        self.name = name


class OrganizationFeature(Feature):
    def __init__(self, name, organization):
        Feature.__init__(self, name)
        self.organization = organization


class ProjectFeature(Feature):
    def __init__(self, name, project):
        Feature.__init__(self, name)
        self.project = project


class ProjectPluginFeature(ProjectFeature):
    def __init__(self, name, project, plugin):
        ProjectFeature.__init__(self, name, project)
        self.plugin = plugin
