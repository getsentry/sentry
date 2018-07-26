from __future__ import absolute_import
import six


class ExperimentManager(object):
    def __init__(self):
        self._experiments = {}

    def add(self, experiments):
        for experiment in experiments:
            self._experiments[experiment.__name__] = experiment

    def all(self, org, actor):
        assignments = {}
        for k, v in six.iteritems(self._experiments):
            assignments[k] = v(org=org, actor=actor).get_variant('exposed', log_exposure=False)
            return assignments
