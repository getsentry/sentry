from pydantic import BaseModel, Field


class MetricWeights(BaseModel):
    klDivergenceWeight: float = Field(default=0.8, description="Weight for KL divergence")
    entropyWeight: float = Field(default=0.2, description="Weight for entropy")


# Config model
class CompareCohortsConfig(BaseModel):
    topKAttributes: int = Field(default=500, description="The number of attributes to return")
    topKBuckets: int = Field(
        default=100, description="The number of buckets to return for each attribute"
    )
    metricWeights: MetricWeights = Field(
        default_factory=MetricWeights, description="The weights for the metrics (KL and entropy)"
    )
    kRRF: int = Field(
        default=60,
        description="Offset constant for RRF, default is 60, as recommended by the paper",
    )
    alphaLaplace: float = Field(default=1e-3, description="Laplace smoothing constant")
    emptyValueAttribute: str = Field(
        default="", description="Attribute used to represent missing values"
    )


class CompareCohortsMeta(BaseModel):
    referrer: str = Field(..., description="The referrer of the request")


# Input models
class StatsAttributeBucket(BaseModel):
    attributeValue: str = Field(..., description="The value of the attribute, e.g. 'chrome'")
    attributeValueCount: float = Field(
        ..., description="The count of this attribute value in the cohort, e.g. 100.0"
    )


class StatsAttribute(BaseModel):
    attributeName: str = Field(..., description="The name of the attribute, e.g. 'browser'")
    buckets: list[StatsAttributeBucket] = Field(..., description="The buckets of the attribute")


class AttributeDistributions(BaseModel):
    attributes: list[StatsAttribute] = Field(
        ..., description="The attribute distributions for the cohort"
    )


class StatsCohort(BaseModel):
    totalCount: float = Field(..., description="The total count of objects in the cohort")
    attributeDistributions: AttributeDistributions = Field(
        ..., description="The attribute distributions for the cohort"
    )


# Request model
class CompareCohortsRequest(BaseModel):
    baseline: StatsCohort = Field(..., description="The baseline cohort")
    selection: StatsCohort = Field(..., description="The selection cohort")
    config: CompareCohortsConfig = Field(
        default_factory=CompareCohortsConfig, description="The config for the comparison"
    )
    meta: CompareCohortsMeta = Field(..., description="The meta data for the request")


# Output models
class AttributeResult(BaseModel):
    attributeName: str = Field(..., description="The name of the attribute, e.g. 'browser'")
    attributeValues: list[str] = Field(
        ...,
        description="The most suspcious values of the attribute, e.g. ['chrome', 'firefox', 'edge']",
    )
    attributeScore: float = Field(
        ..., description="The score measuring how suspcious the attribute is"
    )


# Response model
class CompareCohortsResponse(BaseModel):
    results: list[AttributeResult] = Field(
        ..., description="The list of attributes and their most suspcious values"
    )
