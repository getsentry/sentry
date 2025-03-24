import pandas as pd

from sentry.seer.workflows.compare.models import (
    CompareCohortsConfig,
    CompareCohortsRequest,
    StatsCohort,
)


class DataProcessor:
    """
    Processes cohort data by normalizing and transforming attribute distributions.
    """

    def _preprocess_cohort(self, data: StatsCohort, config: CompareCohortsConfig) -> pd.DataFrame:
        """
        Preprocess a single cohort's attribute distributions into a normalized DataFrame with added unseen value

        Args:
            data: StatsCohort object containing attribute distributions
            config: CompareCohortsConfig containing the configuration for the comparison
        Returns:
            pd.DataFrame: DataFrame with columns:
                - attribute_name: Name of the attribute
                - distribution: Dictionary mapping labels to normalized values
        """

        df = pd.DataFrame(
            [
                {
                    "attribute_name": attr.attributeName,
                    "distribution": {
                        item.attributeValue: item.attributeValueCount / data.totalCount
                        for item in attr.buckets
                    },
                }
                for attr in data.attributeDistributions.attributes
            ]
        )
        df["distribution"] = df["distribution"].apply(lambda x: self._add_unseen_value(x, config))
        return df

    def _add_unseen_value(
        self, distribution: dict[str, float], config: CompareCohortsConfig
    ) -> dict[str, float]:
        """
        Add an unseen value to the distribution if the total probability is less than 1. This can happen when the total count of the attribute is less than the total count of the cohort.

        Args:
            distribution: Dictionary mapping labels to probability values
            config: CompareCohortsConfig containing the configuration for the comparison
        Returns:
            Updated distribution with unseen value added if needed
        """
        totalSum = sum(distribution.values())
        # if the total probability is less than 1, add an unseen value to the distribution
        if totalSum < 1:
            distribution[config.emptyValueAttribute] = 1 - totalSum
        return distribution

    def _transform_distribution(
        self,
        distribution: pd.Series,
        all_keys: list[str],
        total_count: float,
        config: CompareCohortsConfig,
    ) -> dict[str, float]:
        """
        Apply Laplace smoothing to a probability distribution. It's needed to avoid zero probabilities, which would break the KL divergence calculation.

        Args:
            distribution: Series containing the probability distribution
            all_keys: List of all possible keys that should be in the distribution (extracted from the two cohorts)
            total_count: Total count of the cohort
            config: CompareCohortsConfig containing the configuration for the comparison
        Returns:
            Dictionary containing the smoothed distribution with all keys present

        Notes:
            - Missing keys are filled with 0 before smoothing
            - Adds alpha to all values and renormalizes to maintain sum = 1
        """
        # reindex distribution to include all keys, filling missing values with 0
        distribution = distribution.reindex(all_keys, fill_value=0)

        # perform lapalce smoothing of the distribution
        # Add alpha to all values and renormalize
        # division by total_count is needed to ensure that the definiton of Laplace smoothing is correct
        distribution = distribution + config.alphaLaplace / total_count
        return dict(distribution / distribution.sum())

    def prepare_cohort_data(self, request: CompareCohortsRequest) -> pd.DataFrame:
        """
        Prepare and combine baseline and selection cohort data for comparison.

        Args:
            request: CompareCohortsRequest containing both baseline and selection cohorts
        Returns:
            pd.DataFrame: DataFrame with columns:
                - attribute_name: Name of the attribute
                - distribution_baseline: Smoothed baseline distribution
                - distribution_selection: Smoothed selection distribution

        Process:
            1. Preprocesses both baseline and selection data
            2. Merges the datasets on attributeName
            3. Identifies common keys across distributions
            4. Applies Laplace smoothing to both distributions
            5. Cleans up intermediate calculation columns
        """
        config = request.config
        baseline = self._preprocess_cohort(request.baseline, config)
        selection = self._preprocess_cohort(request.selection, config)

        dataset = baseline.merge(
            selection, on="attribute_name", how="inner", suffixes=("_baseline", "_selection")
        )
        # identify common keys which appear in both distributions
        dataset["common_attribute_values"] = dataset.apply(
            lambda row: set(row["distribution_baseline"].keys())
            | set(row["distribution_selection"].keys()),
            axis=1,
        )

        for col in ["distribution_baseline", "distribution_selection"]:
            total_count = (
                request.baseline.totalCount
                if col == "distribution_baseline"
                else request.selection.totalCount
            )
            dataset[col] = dataset.apply(
                lambda row: self._transform_distribution(
                    pd.Series(row[col]), row["common_attribute_values"], total_count, config
                ),
                axis=1,
            )
        # drop the commonKeys column as it's no longer needed
        dataset.drop(columns=["common_attribute_values"], inplace=True)
        return dataset
