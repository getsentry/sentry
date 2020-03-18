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

    def all(self, org=None, actor=None, user=None):
        """
        Returns an object with all the experiment assignments for an organization or user.

        :param org: The organization for org based experiments
        :param actor: The actor for org based experiments
        :param user: The user for user based experiments
        """
        if not org and not user:
            return {}

        assignments = {}

        if org:
            kwargs = {"org": org, "actor": actor}
            unit = "org"
        else:
            kwargs = {"user": user}
            unit = "user"

        for k, v in six.iteritems(self._experiments):
            cls = v["experiment"]
            if hasattr(cls, "unit") and cls.unit == unit:
                assignments[k] = cls(**kwargs).get_variant(v["param"], log_exposure=False)
        return assignments

    def get(self, experiment_name, org=None, actor=None, user=None):
        """
        Returns the assignment for an experiment.

        :param experiment_name:  The name of the experiment
        :param org: The organization for org based experiments
        :param actor: The actor for org based experiments
        :param user: The user for user based experiments
        """
        if not org and not user:
            return None

        value = self._experiments.get(experiment_name)
        if not value:
            return None

        if org:
            kwargs = {"org": org, "actor": actor}
        else:
            kwargs = {"user": user}

        cls = value["experiment"]
        return cls(**kwargs).get_variant(value["param"], log_exposure=False)
