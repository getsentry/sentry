from __future__ import absolute_import

__all__ = ('BoundDateQuerySet', 'BoundDateTimeQuerySet',
           'BoundQuerySet', 'BoundValuesQuerySet')

import six

from django.db.models.query import DateQuerySet, DateTimeQuerySet, QuerySet, ValuesQuerySet


def bound_queryset(cls, prefix='Bound'):
    class new_cls(cls):
        def __init__(self, *args, **kwargs):
            # this must be optional for _clone
            self._binding_criteria_fn = kwargs.pop('binding_criteria_fn', None)
            self._constraints_applied = False
            cls.__init__(self, *args, **kwargs)

        def __getitem__(self, k):
            if self._constraints_applied:
                qs = self
            else:
                qs = self._clone_with_constraints()
            return cls.__getitem__(qs, k)

        # XXX(dcramer): this cloning stuff is expensive -- we could,
        # alternatively, just bind an attribute
        def _clone(self, klass=None, unconstrained_unsafe=False, *args, **kwargs):
            if klass and not unconstrained_unsafe:
                try:
                    klass = CLASS_MAPPING[klass]
                except KeyError:
                    raise NotImplementedError(
                        'Unable to clone to a bound type for {:r}'.format(klass))
            rv = cls._clone(self, klass=klass, *args, **kwargs)
            rv._constraints_applied = self._constraints_applied
            rv._binding_criteria_fn = self._binding_criteria_fn
            return rv

        # XXX(dcramer): if we could find a way to clear these parameters (which is tricky)
        # we could just hook _setup_query instead of the rest of the functions
        # def _setup_query(self):
        #     criteria = self.get_binding_criteria()
        #     if criteria is None:
        #         self.query.set_empty()
        #     else:
        #         self.query.add_q(criteria)

        def _clone_with_constraints(self):
            criteria = self.get_binding_criteria()
            if criteria is None:
                rv = self.none()
            else:
                rv = self.filter(criteria)
            rv._constraints_applied = True
            return rv

        def iterator(self):
            if self._constraints_applied:
                return cls.iterator(self)
            return cls.iterator(self._clone_with_constraints())

        def count(self):
            if self._constraints_applied:
                qs = self
            else:
                qs = self._clone_with_constraints()
            return cls.count(qs)

        def earliest(self, *args, **kwargs):
            raise NotImplementedError

        def latest(self, *args, **kwargs):
            raise NotImplementedError

        def unconstrained_unsafe(self):
            return cls._clone(
                self,
                klass=REVERSE_CLASS_MAPPING[type(self)],
                unconstrained_unsafe=True,
            )

        def get_binding_criteria(self):
            return self._binding_criteria_fn()

    new_cls.__name__ = '{}{}'.format(prefix, cls.__name__)
    return new_cls


BoundQuerySet = bound_queryset(QuerySet)
BoundValuesQuerySet = bound_queryset(ValuesQuerySet)
BoundDateQuerySet = bound_queryset(DateQuerySet)
BoundDateTimeQuerySet = bound_queryset(DateTimeQuerySet)

CLASS_MAPPING = {
    QuerySet: BoundQuerySet,
    ValuesQuerySet: BoundValuesQuerySet,
    DateQuerySet: BoundDateQuerySet,
    DateTimeQuerySet: BoundDateTimeQuerySet,
}

REVERSE_CLASS_MAPPING = {v: k for k, v in six.iteritems(CLASS_MAPPING)}
