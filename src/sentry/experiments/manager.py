from __future__ import absolute_import
import six


class ExperimentManager(object):
    def __init__(self):
        self._experiments = {}

    def add(self, experiment, param, log_exposure=True):
        self._experiments[experiment.__name__] = {
            'experiment': experiment, 'param': param, 'log_exposure': log_exposure}

    def all(self, org, actor):
        assignments = {}
        for k, v in six.iteritems(self._experiments):
            cls = v['experiment']
            assignments[k] = cls(
                org=org, actor=actor).get_variant(
                v['param'], log_exposure=v['log_exposure'])
            return assignments
