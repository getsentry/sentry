from typing import int
query = """query GetTestResultsAggregates(
    $owner: String!
    $repo: String!
    $branch: String
    $interval: MeasurementInterval
) {
    owner(username: $owner) {
        repository: repository(name: $repo) {
            __typename
            ... on Repository {
                testAnalytics {
                    testResultsAggregates(branch: $branch, interval: $interval) {
                        totalDuration
                        totalDurationPercentChange
                        slowestTestsDuration
                        slowestTestsDurationPercentChange
                        totalSlowTests
                        totalSlowTestsPercentChange
                        totalFails
                        totalFailsPercentChange
                        totalSkips
                        totalSkipsPercentChange
                    }
                    flakeAggregates(branch: $branch, interval: $interval) {
                        flakeCount
                        flakeCountPercentChange
                        flakeRate
                        flakeRatePercentChange
                    }
                }
            }
            ... on NotFoundError {
                message
            }
        }
    }
}"""
