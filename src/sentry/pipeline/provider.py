class PipelineProvider:
    """
    A class implementing the PipelineProvider interface provides the pipeline
    views that the Pipeline will traverse through.
    """

    def __init__(self):
        self.config = {}

    def get_pipeline_views(self):
        """
        Returns a list of instantiated views which implement the PipelineView
        interface. Each view will be dispatched in order.
        >>> return [OAuthInitView(), OAuthCallbackView()]
        """
        raise NotImplementedError

    def update_config(self, config):
        """
        Use update_config to allow additional provider configuration be assigned to
        the provider instance. This is useful for example when nesting
        pipelines and the provider needs to be configured differently.
        """
        self.config.update(config)

    def set_pipeline(self, pipeline):
        """
        Used by the pipeline to give the provider access to the executing pipeline.
        """
        self.pipeline = pipeline
