# Pipelines Utility

The `sentry.pipeline` module provides functionality for executing a series of
views that maintain arbitrary state across each request and moves the user
through the "pipeline".

Some key points to understanding pipelines:

 * A pipeline executes a set of views (that receive the `pipeline` instance),
   moving through them by having the view itself call `pipeline.next_step`.

 * Each executed view may maintain state within the pipeline using the
   `pipeline.bind_state` method. This state is associated to the users
   session.

 * Pipelines are always subclassed to implement the `finish_pipeline` method,
   this method will be called when a pipeline completes.

 * Pipelines are given the set of pipeline views (instances of `PipelineView`
   subclasses) via the `get_pipeline_views` method of the Pipeline Provider
   object that is associated to a particular provider key.

 * Pipelines are usually constructed and executed by either two view endpoints.
   One to call the pipelines `initialize` method, and the next which is
   called to move through the pipeline

 * Pipelines are bound to a specific session when they are being executed.

## Pipeline Providers

Pipelines are given their process implementation details through the pipeline
provider, an interface class exists, `PipelineProvider`, which declares the
required methods. You can think of the provider as the implementation of the
actual processes that the user is being guided through. The provider specifies
the pipeline steps.

A single pipeline may have multiple types of providers for the pipeline which
define different flows on a per provider basis, but all complete a similar type
of pipeline process.

A good example of a pipeline with multiple types of providers is the
`sentry.identity.pipeline` module, which makes use of a Pipeline to associate
user identities. Sentry has various identity types (github, slack, google) each
which may use a slightly different process to do identity lookup on the
external service, however the end of the process (and what is done in the
final `finish_pipeline` call) all result in an Identity object being created.

### Provider Manager

The pipeline is not directly given a provider, but instead it is given a key
that is used to lookup the provider within the provided `provider_manager`
instance.

There is no explicit interface for the manager object other than that it should
have a `get` method that takes the `provider_key` and returns an instance of
the provider.

## Pipeline Provider Model

While not explicitly required, a pipeline supports lookup of a model that is
associated to a particular pipeline. This allows the pipeline to automatically
lookup the model given to the pipeline upon it's first initialization.

This simply moves the boiler plate of looking up a model from the pipeline
views, into it already being available as `pipeline.provider_model` within any
view that has access to the pipeline.

The model is configured by the `provider_model_cls` pipeline class attribute.

## Pipeline Views

Pipeline views are objects that implement the `PipelineView` interface and are
used as part of the list of views that a pipeline executes. The pipeline views
receive the executing request object when they are the step being executed,
along with the `pipeline` instance itself.

It's the job of the pipeline view to transition the pipeline to the next step
in the pipeline and bind any data that may need to be used later in the
pipeline or must be available when the pipeline completes.

An example pipeline view might be a form that asks the user for some input.

```python
class GetUserInput(PipelineView):
    def dispatch(self, request, pipeline):
        # The pipeline supports a generic error method that will render a
        # pipeline error view
        if 'my_data' not in request.POST:
            return pipeline.error('Data was not sent')

        # Form submitted, bind user data and move to and render the next step
        # in the pipeline.
        if request.POST is not None:
            pipeline.bind_state('user_input', request.POST)
            return pipeline.next_step()

        # Render form template
        return render_view('app/pipeline_input.html')
```

The pipeline views are declared within the executing pipeline provider's
`get_pipeline_views` method, for example it could look like:

```python
def get_pipeline_views(self):
    return [GetUserInput(), RequestApiTokenStep()]
```

Executing a pipeline
--------------------

Executing a pipeline is done through either one or two views.

With one view it will both initialize the pipeline, and traverse through the
pipeline. The downside of this approach is that the provider key,
and potentially other information must be known at request time of each step,
which may not always be possible (think strict oAuth redirect URL that cannot
be parameterized)

This may look something like

```python
def handle_request(self, request, organization, provider_key):
    pipeline = MyPipeline(
        request=request,
        organization=organization,
        provider_key=provider_key,
    )

    # Since we are handling initialization in the same view as moving through
    # the pipeline, we have to check if we already have a valid pipeline, to
    # avoid re-initialization.
    if not pipeline.is_valid():
        pipeline.initialize()

    return pipeline.current_step()
```

Using a second view would remove the `is_valid` check from the initialization
view, and then the second view would lookup the pipeline using it's
`get_for_request` method. Which would look something like:

```python
def handle_request(self, request):
    pipeline = MyPipeline.get_for_request(request)

    # If the pipeline isn't correctly initialized error out
    if pipeline is None or not pipeline.is_valid():
        return HttpResponse(code=400)

    # Pipeline is already initialized
    return pipeline.current_step()
```

The advantage of a view specifically for traversing through the view is that if
the user does not complete a pipeline, and later comes back to traverse through
the same pipeline from the start, the initialize view will clear the pipeline
state.

## Nested Pipeline Views

Nested Pipelines is a pipeline concept and utility class to support composition
of pipelines together. For example, if you want to include an entire other
pipeline as steps within another pipeline, you can do this using the
`NestedPipelineView`.

 * The `NestedPipelineView` is itself a `PipelineView` and should be used
   directly in the list of pipeline views returned by a provider.

 * When a nested pipeline completes, it very importantly does *not* call the
   `finish_pipeline` method on the pipeline itself, instead the state is
   bound into the parent pipeline.

 * Nested pipelines use the "single view"

An example of a nested pipeline looks like:

```python
def get_pipeline_views(self):
    identity_pipeline_config = {
        'oauth_scopes': self.identity_oauth_scopes,
        'redirect_url': absolute_uri('/extensions/slack/setup/'),
    }

    identity_pipeline_view = NestedPipelineView(
        bind_key='identity',
        provider_key='slack',
        pipeline_cls=IdentityProviderPipeline,
        config=identity_pipeline_config,
    )

    return [identity_pipeline_view]
```
