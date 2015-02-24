from __future__ import absolute_import

__all__ = ['Feature', 'OrganizationFeature']


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
        self.name = name
        self.organization = organization
