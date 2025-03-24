import pandas as pd
from scipy.special import rel_entr
from scipy.stats import entropy

from sentry.seer.workflows.compare.models import CompareCohortsConfig


class CohortsMetricsScorer:
    """
    Scores cohort comparisons using multiple metrics including KL divergence and entropy.

    This class implements a reciprocal rank fusion (RRF) approach to combine multiple
    scoring metrics into a final ranking score.
    """

    @staticmethod
    def _kl_metric_lambda(baseline: dict[str, float], selection: dict[str, float]) -> pd.Series:
        """
        Calculate the Kullback-Leibler divergence between baseline and selection distributions.

        Args:
            baseline: Probability distribution of the baseline cohort
            selection: Probability distribution of the selection cohort

        Returns:
            Series containing the KL divergence values for each attribute value

        Notes:
            Uses relative entropy to measure how selection distribution differs from baseline
        """
        return rel_entr(pd.Series(baseline), pd.Series(selection))

    def compute_metrics(self, dataset: pd.DataFrame, config: CompareCohortsConfig) -> pd.DataFrame:
        """
        Compute all metrics for the dataset and combine them using RRF.

        Args:
            dataset: DataFrame containing baseline and selection distributions
            config: Config for the comparison

        Returns:
            DataFrame with added columns for KL scores, entropy scores, and final RRF score,
            sorted by RRF score in descending order

        Process:
            1. Computes KL divergence scores
            2. Computes entropy scores
            3. Combines scores using RRF with provided weights
        """
        dataset = (
            dataset.pipe(self._compute_kl_score)
            .pipe(self._compute_entropy_score)
            .pipe(self._compute_rrf_score, config)
        )
        return dataset

    def _compute_kl_score(self, dataset: pd.DataFrame) -> pd.DataFrame:
        """
        Compute KL divergence scores for each attribute. Higher KL divergence scores indicate greater difference between distributions.

        Args:
            dataset: DataFrame containing baseline and selection distributions

        Returns:
            DataFrame with added columns:
                - kl_individual_scores: Dictionary of KL divergence scores per value
                - kl_score: Sum of individual KL divergence scores

        Notes:
            Higher KL scores indicate greater difference between distributions
        """

        # these scores are needed to rank the values within each attribute
        dataset["kl_individual_scores"] = dataset.apply(
            lambda row: self._kl_metric_lambda(
                row["distribution_baseline"], row["distribution_selection"]
            ).to_dict(),
            axis=1,
        )
        # sum the scores to get the total KL divergence score for each attribute
        dataset["kl_score"] = dataset["kl_individual_scores"].apply(lambda x: sum(x.values()))
        return dataset

    def _compute_entropy_score(self, dataset: pd.DataFrame) -> pd.DataFrame:
        """
        Compute entropy scores for the selection distribution. We prefer lower entropy scores, as they indicate more concentrated (less uniform) distributions.

        Args:
            dataset: DataFrame containing selection distributions

        Returns:
            DataFrame with added column:
                - entropy_score: Entropy value for each selection distribution

        Notes:
            Lower entropy indicates more concentrated (less uniform) distributions
        """

        dataset["entropy_score"] = dataset["distribution_selection"].apply(
            lambda x: entropy(pd.Series(x))
        )
        return dataset

    def _compute_rrf_score(
        self, dataset: pd.DataFrame, config: CompareCohortsConfig
    ) -> pd.DataFrame:
        """
        Compute the final RRF score combining KL divergence and entropy rankings.

        Args:
            dataset: DataFrame containing KL and entropy scores
            config: CompareCohortsConfig containing the configuration for the comparison
        Returns:
            DataFrame with added columns:
                - klRank: RRF-transformed KL divergence rank
                - entropyRank: RRF-transformed entropy rank
                - rrfScore: Weighted combination of transformed ranks

        Notes:
            - Higher RRF scores indicate more interesting/significant differences
            - KL ranks are ordered descending (higher is more interesting)
            - Entropy ranks are ordered ascending (lower is more interesting)
            - Intermediate rank columns are dropped from final output
        """

        dataset["kl_rank"] = 1 / (
            config.kRRF + dataset["kl_score"].rank(method="min", ascending=False)
        )
        dataset["entropy_rank"] = 1 / (
            config.kRRF + dataset["entropy_score"].rank(method="min", ascending=True)
        )
        dataset["rrf_score"] = (
            config.metricWeights.klDivergenceWeight * dataset["kl_rank"]
            + config.metricWeights.entropyWeight * dataset["entropy_rank"]
        )
        # drop intermediate rank columns as they are no longer needed
        dataset.drop(columns=["kl_rank", "entropy_rank"], inplace=True)
        # sort the dataset by RRF score in descending order
        return dataset.sort_values(by="rrf_score", ascending=False).reset_index(drop=True)
