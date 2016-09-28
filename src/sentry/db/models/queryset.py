from __future__ import absolute_import

from django.db.models.query import QuerySet


class InvalidQuerySet(Exception):
    pass


class RestrictedQuerySet(QuerySet):
    required_filter = [
        'organization',
        'organization_id',
        'project',
        'project_id',
        'team',
        'team_id',
    ]

    def __init__(self, *args, **kwargs):
        super(RestrictedQuerySet, self).__init__(*args, **kwargs)
        self._requirements_passed = False

    def _fetch_all(self, *args, **kwargs):
        if not getattr(self, '_requirements_passed', False):
            raise InvalidQuerySet('A required filter was missing on one of the following columns: %s' % ', '.join(self.required_filter))
        return super(RestrictedQuerySet, self)._fetch_all(*args, **kwargs)

    def _clone(self, *args, **kwargs):
        c = super(RestrictedQuerySet, self)._clone(*args, **kwargs)
        c._requirements_passed = self._requirements_passed
        return c

    def create(self, *args, **kwargs):
        self._requirements_passed = True
        return super(RestrictedQuerySet, self).create(*args, **kwargs)

    def filter(self, *args, **kwargs):
        print (args, kwargs)
        for key, value in kwargs.iteritems():
            if key in self.required_filter:
                self._requirements_passed = True
        return super(RestrictedQuerySet, self).filter(*args, **kwargs)
