query = """query GetTestResultsAggregates(
    $owner: String!
    $repo: String!
    $interval: MeasurementInterval
) {
    owner(username: $owner) {
        repository: repository(name: $repo) {
            __typename
            ... on Repository {
                testAnalytics {
                    testResultsAggregates(interval: $interval) {
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
                }
            }
            ... on NotFoundError {
                message
            }
        }
    }
}"""
