from __future__ import absolute_import, print_function

from sentry.models import Organization
from sentry.web.frontend.base import BaseView
from sentry.utils.session_store import RedisSessionStore
from sentry.utils.hashlib import md5_text


class PipelineableProvider(object):
    """
    A class implementing the PipelineableProvider interface provides the
    pipeline views that the ProviderPipeline will traverse through.
    """

    def get_pipeline(self):
        """
        Returns a list of instantiated views which implement the PipelineView
        class. Each view will be dispatched in order.
        >>> return [OAuthInitView(), OAuthCallbackView()]
        """
        raise NotImplementedError

    def set_config(self, config):
        """
        Use set_config to allow additional provider configuration be assend to
        the provider instance. This is useful for example when nesting
        pipelines and the provider needs to be configured differently.
        """
        self.config = config


class PipelineView(BaseView):
    """
    A class implementing the PipelineView may be used in a PipleineProviders
    get_pipeline list.
    """

    def dispatch(self, request, pipeline):
        """
        Called on request, the active pipeline is passed in which can and
        should be used to bind data and traverse the pipeline.
        """
        raise NotImplementedError


class NestedPipelineView(PipelineView):
    """
    A NestedPipelineView can be used within other pipelines to process another
    pipeline within a pipeline. Note that the nested pipelines finish_pipeline
    will NOT be called, instead it's data will be bound into the parent
    pipeline and the parents pipeline moved to the next step.

    Useful for embeding an identity authentication pipeline.
    """

    def __init__(self, bind_key, pipeline_cls, provider_key, config={}):
        self.provider_key = provider_key
        self.config = config

        class NestedPipeline(pipeline_cls):
            def set_parent_pipeline(self, parent_pipeline):
                self.parent_pipeline = parent_pipeline

            def finish_pipeline(self):
                self.parent_pipeline.bind_state(bind_key, self.fetch_state())
                self.clear_session()

                return self.parent_pipeline.next_step()

        self.pipeline_cls = NestedPipeline

    def dispatch(self, request, pipeline):
        nested_pipeline = self.pipeline_cls(
            organization=pipeline.organization,
            request=request,
            provider_key=self.provider_key,
            config=self.config,
        )

        nested_pipeline.set_parent_pipeline(pipeline)

        if not nested_pipeline.is_valid():
            nested_pipeline.initialize()

        return nested_pipeline.current_step()


class ProviderPipeline(object):
    """
    ProviderPipeline provides a mechanism to guide the user through a request
    'pipeline', where each view may be copleted by calling the ``next_step``
    pipeline method to traverse through the pipe.

    The provider pipeline works with a Provider object which provides the
    pipeline views and is made available to the views through the passed in
    pipeline.

    :provider_manager:
    A class property that must be specified to allow for lookup of a provider
    implmentation object given it's key.

    :provider_model_cls:
    The Provider model object represents the instance of an object implementing
    the PipelineableProvider interface. This is used to look up the instance
    when cosntructing an in progress pipleine (get_for_request).

    :config:
    A object that specifies additional pipeline and provider runtime
    configurations. An example of usage is for OAuth Identity providers, for
    overriding the scopes. The config object will be passed into the provider
    using the ``set_config`` method.
    """
    pipeline_name = None
    provider_manager = None
    provider_model_cls = None

    @classmethod
    def get_for_request(cls, request):
        state = RedisSessionStore(request, cls.pipeline_name)
        if not state.is_valid():
            return None

        organization_id = state.org_id
        if not organization_id:
            return None

        provider_model = None
        if state.provider_model_id:
            provider_model = cls.provider_model_cls.objects.get(id=state.provider_model_id)

        organization = Organization.objects.get(id=state.org_id)
        provider_key = state.provider_key
        config = state.config

        return cls(request, organization, provider_key, provider_model, config)

    def __init__(self, request, organization, provider_key, provider_model=None, config={}):
        self.request = request
        self.organization = organization
        self.state = RedisSessionStore(request, self.pipeline_name)
        self.provider = self.provider_manager.get(provider_key)
        self.provider_model = provider_model

        self.config = config
        self.provider.set_config(config)

        self.pipeline = self.provider.get_pipeline()

        # we serialize the pipeline to be ['fqn.PipelineView', ...] which
        # allows us to determine if the pipeline has changed during the auth
        # flow or if the user is somehow circumventing a chunk of it
        pipe_ids = ['{}.{}'.format(type(v).__module__, type(v).__name__) for v in self.pipeline]
        self.signature = md5_text(*pipe_ids).hexdigest()

    def is_valid(self):
        return self.state.is_valid() and self.state.signature == self.signature

    def initialize(self):
        self.state.regenerate({
            'uid': self.request.user.id if self.request.user.is_authenticated() else None,
            'provider_model_id': self.provider_model.id if self.provider_model else None,
            'provider_key': self.provider.key,
            'org_id': self.organization.id,
            'step_index': 0,
            'signature': self.signature,
            'config': self.config,
            'data': {},
        })

    def clear_session(self):
        self.state.clear()

    def current_step(self):
        """
        Render the current step.
        """
        step_index = self.state.step_index

        if step_index == len(self.pipeline):
            return self.finish_pipeline()

        return self.pipeline[step_index].dispatch(
            request=self.request,
            pipeline=self,
        )

    def error(self, message):
        # TODO: Implement this here
        raise NotImplementedError

    def next_step(self):
        """
        Render the next step.
        """
        self.state.step_index += 1
        return self.current_step()

    def finish_pipeline(self):
        """
        Called when the pipeline complets the final step.
        """
        raise NotImplementedError

    def bind_state(self, key, value):
        data = self.state.data
        data[key] = value

        self.state.data = data

    def fetch_state(self, key=None):
        return self.state.data if key is None else self.state.data.get(key)
