from __future__ import absolute_import

__all__ = ['Feature', 'OrganizationFeature', 'ProjectFeature',
           'ProjectPluginFeature']


class Feature(object):
    def __init__(self, name):
        self.name = name

    def has(self, actor):
        """
        A feature may return one of three values:

        - True: the feature is enabled for actor
        - False: the feature is not enabled for actor
        - None: defer
        """
        return None


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
