from abc import ABC, abstractmethod

from sentry.sentry_metrics.querying.data.execution import QueryResult


class PostProcessingStep(ABC):
    """
    Represents an abstract step that post-processes a collection of QueryResult objects.

    The post-processing of these objects might include transforming them or just obtaining some intermediate data that
    is useful to compute other things before returning the results.
    """

    @abstractmethod
    def run(self, query_results: list[QueryResult]) -> list[QueryResult]:
        """
        Runs the post-processing steps on a list of query results.

        Returns:
            A list of post-processed query results.
        """
        raise NotImplementedError


def run_post_processing_steps(query_results: list[QueryResult], *steps) -> list[QueryResult]:
    """
    Takes a series of query results and steps and runs the post-processing steps one after each other in order they are
    supplied in.

    Returns:
        A list of query results after running the post-processing steps.
    """
    for step in steps:
        if isinstance(step, PostProcessingStep):
            query_results = step.run(query_results=query_results)

    return query_results
