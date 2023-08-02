from .builder import E, Q
from .expansion import ExpansionLayer, register_derived_metric
from .indexes import IndexLayer
from .metadata import ValidationLayer
from .naming import NamingLayer, register_public_name
from .optimization import MergeFiltersLayer
from .pipeline import QueryPipeline
from .timeframe import TimeframeLayer
from .types import SeriesQuery, SeriesResult

__all__ = (
    "E",
    "get_series",
    "Q",
    "register_derived_metric",
    "register_public_name",
    "SeriesQuery",
    "SeriesResult",
)


def get_series(query: SeriesQuery, public: bool = False) -> SeriesResult:
    """
    Execute a series query and return the result.

    :param query: The query object to execute.
    :param public: Whether to map metric names and tag names to a public
        namespace. If this is True, MRIs and private metrics cannot be used.
    """

    return (
        QueryPipeline()
        .layer_if(public, NamingLayer())
        .layer(TimeframeLayer())
        .layer(ExpansionLayer())
        .layer(IndexLayer())
        .layer(MergeFiltersLayer())
        .layer(ValidationLayer())
        .execute(query)
    )
