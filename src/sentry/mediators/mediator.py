from __future__ import absolute_import

import datetime
import logging
import six
import sentry

from contextlib import contextmanager
from django.db import transaction

from sentry.utils.cache import memoize
from sentry.utils.functional import compact
from .param import Param


class Mediator(object):
    """
    Objects that encapsulate domain logic.

    Mediators provide a layer between User accessible components like Endpoints
    and the database. They encapsulate the logic necessary to create domain
    objects, including all dependant objects, cross-object validations, etc.

    Mediators are intended to be composable and make it obvious where a piece
    of domain logic resides.

    Invocation:
        Invoke Mediators through their ``run`` class method. This essentially
        just wraps ``__init__(**kwargs).call()`` with some useful stuff,
        namely a DB transaction.

        >>> Mediator.run(**kwargs)

    Declaration:
        Mediators should define two things - a set of ``Param``s and a ``call``
        function.

        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type)
        >>>
        >>>     def call(self):
        >>>         with self.log():
        >>>             Thing.objects.create(name=self.name)
        >>>
        >>> Creator.run(name='thing')
        >>>

    Transactions
        Mediators are automatically wrapped in a transaction. As long as you
        invoke them via their ``run`` class method, you don't need to worry
        about declaring one yourself.

    Naming & Organization Conventions
        Mediators are organized by domain object and describe some domain
        process relevant to that object. For example:

            sentry.mediators.sentry_apps.Creator
            sentry.mediators.sentry_apps.Deactivator

    Params:
        Mediators declare the params they need similarly to Models. On
        instantiation, the Mediator will validate using the ``**kwargs``
        passed in.

        >>> from sentry.mediators import Mediator, Param
        >>>
        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type, default='example')
        >>>     user = Param('sentry.models.user.User', none=True)

        See ``sentry.mediators.param`` for more in-depth docs.

    Interface:
        Mediators have two main functions you should be aware of.

        ``run``:
            Convenience function for ``__init__(**kwargs).call()``

        ``call``:
            Instance method where you should implement your logic.

        >>> class Creator(Mediator):
        >>>     name = Param(six.binary_type, default='example')
        >>>
        >>>     def call(self):
        >>>         Thing.objects.create(name=self.name)

    Logging:
        Mediators have a ``log`` function available to them that will write to
        a logger with a standardized name. The name will be the full module
        path and class of the Mediator.

        When invoked via ``run``, the Mediator will automaticallyt log the
        start and end of its run.

        >>> class Creator(Mediator):
        >>>     def call(self):
        >>>         self.log(at='step')
        >>>
        >>> Creator.run()
        18:14:26 [INFO] sentry.mediators.sentry_apps.creator.Creator:  (at=u'step')  # NOQA

    Measuring:
        Mediators will automatically log the start and finish time of
        execution. If it ends via an Exception, it will log that instead of the
        finish time.

        The exception logging it just meant to augment what you get in Sentry
        itself, not replace anything about it. It's sometimes useful to see the
        progression of a request through many Mediators.

        You can manually use ``log`` to either write a set of attributes to
        stdout

        >>> self.log(at='a-special-step')
        18:14:26 [INFO] sentry.mediators.things.creator.Creator:  (at=u'a-special-step')  # NOQA

        or as a generator do log the start and finish of a block of
        code.

        >>> with self.log():
        >>>     do_a_thing()
        18:14:26 [INFO] sentry.mediators.things.creator.Creator:  (at=u'start')  # NOQA
        18:14:27 [INFO] sentry.mediators.things.creator.Creator:  (at=u'finish', elapsed=1634)  # NOQA
    """

    # Have we processed the Param declarations yet. Should happen once per
    # class.
    _params_prepared = False

    @classmethod
    def _prepare_params(cls):
        if sentry.mediators.mediator.Mediator in cls.__bases__ and not cls._params_prepared:
            params = [(k, v) for k, v in six.iteritems(cls.__dict__) if isinstance(v, Param)]
            for name, param in params:
                param.setup(cls, name)
            cls._params_prepared = True

    @classmethod
    def run(cls, *args, **kwargs):
        with transaction.atomic():
            obj = cls(*args, **kwargs)

            with obj.log():
                result = obj.call()
                obj.audit()
                obj.record_analytics()
        obj.post_install()
        return result

    def __init__(self, *args, **kwargs):
        self.kwargs = kwargs
        self.logger = kwargs.get("logger", logging.getLogger(self._logging_name))
        self._prepare_params()
        self._validate_params(**kwargs)

    def audit(self):
        # used for creating audit log entries
        pass

    def record_analytics(self):
        # used to record data to Amplitude
        pass

    def post_install(self):
        # used to call any hooks that have to happen after the transaction has been committed
        pass

    def call(self):
        raise NotImplementedError

    def log(self, **kwargs):
        if any(kwargs):
            extra = {}
            extra.update(self._default_logging)
            extra.update(self._logging_context)
            extra.update(kwargs)
            self.logger.info(None, extra=extra)
        else:
            return self._measured(self)

    def _validate_params(self, **kwargs):
        for name, param in six.iteritems(self._params):
            if param.is_required:
                param.validate(self, name, self.__getattr__(name))

    def __getattr__(self, key):
        if key in self.kwargs:
            return self.kwargs.get(key)

        param = self._params.get(key)

        if param and param.has_default:
            return param.default(self)

        if param and not param.is_required and not param.has_default:
            return None

        try:
            return self.__getattribute__(key)
        except AttributeError:
            return None

    @property
    def _params(self):
        # These will be named ``_<name>`` on the class, so remove the ``_`` so
        # that it matches the name we'll be invoking on the Mediator instance.
        return dict(
            (k[1:], v) for k, v in six.iteritems(self.__class__.__dict__) if isinstance(v, Param)
        )

    @memoize
    def _logging_name(self):
        return ".".join([self.__class__.__module__, self.__class__.__name__])

    @property
    def _default_logging(self):
        from sentry.app import env

        if (
            not env.request
            or not hasattr(env.request, "resolver_match")
            or not hasattr(env.request.resolver_match, "kwargs")
        ):
            return {}

        request_params = env.request.resolver_match.kwargs

        return compact(
            {
                "org": request_params.get("organization_slug"),
                "team": request_params.get("team_slug"),
                "project": request_params.get("project_slug"),
            }
        )

    @property
    def _logging_context(self):
        """
        Overwrite this function to add attributes to automatic log lines.
        """
        return {}

    @contextmanager
    def _measured(self, context):
        start = datetime.datetime.now()
        context.log(at="start")

        try:
            yield
        except Exception as e:
            context.log(at="exception", elapsed=self._milliseconds_since(start))
            raise e

        context.log(at="finish", elapsed=self._milliseconds_since(start))

    def _milliseconds_since(self, start):
        now = datetime.datetime.now()
        elapsed = now - start
        return (elapsed.seconds * 1000) + (elapsed.microseconds / 1000)
