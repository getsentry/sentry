from __future__ import absolute_import
import six


class ExperimentManager(object):
    """
    Allows loading of experiment assignments (done in getsentry) on the frontend by
    including them in the serialized org details via the org serializer which is in sentry.
    """

    def __init__(self):
        self._experiments = {}

    def add(self, experiment, param):
        """
        >>> ExperimentManager.add(ExperimentClass, param='name_of_param')
        """
        self._experiments[experiment.__name__] = {"experiment": experiment, "param": param}

    def all(self, org, actor=None):
        """
        Returns an object with all the experiment assignments for the org.
        """
        assignments = {}
        for k, v in six.iteritems(self._experiments):
            cls = v["experiment"]
            assignments[k] = cls(org=org, actor=actor).get_variant(v["param"], log_exposure=False)
        return assignments

    def get(self, experiment_name, org, actor=None):
        """
        Returns the assignment for an experiment.
        """
        value = self._experiments.get(experiment_name)
        if not value:
            return None
        cls = value["experiment"]
        return cls(org=org, actor=actor).get_variant(value["param"], log_exposure=False)
