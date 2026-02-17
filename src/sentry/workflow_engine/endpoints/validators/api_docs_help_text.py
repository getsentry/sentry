WORKFLOW_CONFIG_HELP_TEXT = """
        Typically the frequency at which the alert will fire, in minutes.

        - `0`: 0 minutes
        - `5`: 5 minutes
        - `10`: 10 minutes
        - `30`: 30 minutes
        - `60`: 1 hour
        - `180`: 3 hours
        - `720`: 12 hours
        - `1440`: 24 hours

        ```json
            {
                "frequency":3600
            }
        ```
        """

WORKFLOW_TRIGGERS_HELP_TEXT = """The conditions on which the alert will trigger. See available options below.
        ```json
            "triggers": {
                "organizationId": "1",
                "logicType": "any-short",
                "conditions": [
                    {
                        "type": "first_seen_event",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "type": "issue_resolved_trigger",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "type": "reappeared_event",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "type": "regression_event",
                        "comparison": true,
                        "conditionResult": true
                    }
                ],
                "actions": []
            }
        ```
        """

ACTION_FILTERS_HELP_TEXT = """The filters to run before the action will fire and the action(s) to fire.

        `logicType` can be one of `any-short`, `all`, or `none`.

        Below is a basic example. See below for all other options.

        ```json
            "actionFilters": [
                {
                    "logicType": "any",
                    "conditions": [
                        {
                            "type": "level",
                            "comparison": {
                                "level": 50,
                                "match": "eq"
                            },
                            "conditionResult": true
                        }
                    ],
                    "actions": [
                        {
                            "id": "123",
                            "type": "email",
                            "integrationId": null,
                            "data": {},
                            "config": {
                                "targetType": "user",
                                "targetDisplay": null,
                                "targetIdentifier": "56789"
                            },
                            "status": "active"
                        }
                    ]
                }
            ]
        ```

        ## Conditions

        **Issue Age**
        - `time`: One of `minute`, `hour`, `day`, or `week`.
        - `value`: A positive integer.
        - `comparisonType`: One of `older` or `newer`.
        ```json
            {
                "type": "age_comparison",
                "comparison": {
                    "time": "minute",
                    "value": 10,
                    "comparisonType": "older"
                },
                "conditionResult": true
            }

        ```

        **Issue Assignment**
        - `targetType`: Who the issue is assigned to
            - `NoOne`: Unassigned
            - `Member`: Assigned to a user
            - `Team`: Assigned to a team
        - `targetIdentifier`: The ID of the user or team from the `targetType`. Enter "" if `targetType` is `NoOne`.
        ```json
            {
                "type": "assigned_to",
                "comparison": {
                    "targetType": "Member",
                    "targetIdentifier": 123456
                },
                "conditionResult": true
            }
        ```

        **Issue Category**
        - `value`: The issue category to filter to.
            - `1`: Error issues
            - `6`: Feedback issues
            - `10`: Outage issues
            - `11`: Metric issues
            - `12`: DB Query issues
            - `13`: HTTP Client issues
            - `14`: Front end issues
            - `15`: Mobile issues
        ```json
            {
                "type": "issue_category",
                "comparison": {
                    "value": 1
                },
                "conditionResult": true
            }
        ```

        **Issue Frequency**
        - `value`: A positive integer representing how many times the issue has to happen before the alert will fire.
        ```json
            {
                "type": "issue_occurrences",
                "comparison": {
                    "value": 10
                },
                "conditionResult": true
            }
        ```

        **De-escalation**
        ```json
            {
                "type": "issue_priority_deescalating",
                "comparison": true,
                "conditionResult": true
            }
        ```

        **Issue Priority**
        - `comparison`: The priority the issue must be for the alert to fire.
            - `75`: High priority
            - `50`: Medium priority
            - `25`: Low priority
        ```json
            {
                "type": "issue_priority_greater_or_equal",
                "comparison": 75,
                "conditionResult": true
            }
        ```

        **Number of Users Affected**
        - `value`: A positive integer representing the number of users that must be affected before the alert will fire.
        - `filters`: A list of additional sub-filters to evaluate before the alert will fire.
        - `interval`: The time period in which to evaluate the value. e.g. Number of users affected by an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "event_unique_user_frequency_count",
                "comparison": {
                    "value": 100,
                    "filters": [{"key": "foo", "match": "eq", "value": "bar"}],
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Number of Events**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Number of events in an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "event_frequency_count",
                "comparison": {
                    "value": 100,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Percent of Events**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Number of events in an issue is `comparisonInterval` percent higher `value` compared to `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        - `comparisonInterval`: The time period to compare against. See `interval` for options.
        ```json
            {
                "type": "event_frequency_percent",
                "comparison": {
                    "value": 100,
                    "interval": "1h",
                    "comparisonInterval": "1w"
                },
                "conditionResult": true
            }

        ```

        **Percentage of Sessions Affected Count**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Percentage of sessions affected by an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "percent_sessions_count",
                "comparison": {
                    "value": 10,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Percentage of Sessions Affected Percent**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Percentage of sessions affected by an issue is `comparisonInterval` percent higher `value` compared to `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        - `comparisonInterval`: The time period to compare against. See `interval` for options.
        ```json
            {
                "type": "percent_sessions_percent",
                "comparison": {
                    "value": 10,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Event Attribute**
        The event's `attribute` value `match` `value`

        - `attribute`: The event attribute to match on. Valid values are: `message`, `platform`, `environment`, `type`, `error.handled`, `error.unhandled`, `error.main_thread`, `exception.type`, `exception.value`, `user.id`, `user.email`, `user.username`, `user.ip_address`, `http.method`, `http.url`, `http.status_code`, `sdk.name`, `stacktrace.code`, `stacktrace.module`, `stacktrace.filename`, `stacktrace.abs_path`, `stacktrace.package`, `unreal.crash_type`, `app.in_foreground`.
        - `match`: The comparison operator
            - `co`: Contains
            - `nc`: Does not contain
            - `eq`: Equals
            - `ne`: Does not equal
            - `sw`: Starts with
            - `ew`: Ends with
            - `is`: Is set
            - `ns`: Is not set
        - `value`: A string. Not required when match is `is` or `ns`.

        ```json
            {
                "type": "event_attribute",
                "comparison": {
                    "match": "co",
                    "value": "bar",
                    "attribute": "message"
                },
                "conditionResult": true
            }
        ```

        **Tagged Event**
        The event's tags `key` match `value`
        - `key`: The tag value
        - `match`: The comparison operator
            - `co`: Contains
            - `nc`: Does not contain
            - `eq`: Equals
            - `ne`: Does not equal
            - `sw`: Starts with
            - `ew`: Ends with
            - `is`: Is set
            - `ns`: Is not set
        - `value`: A string. Not required when match is `is` or `ns`.

        ```json
            {
                "type": "tagged_event",
                "comparison": {
                    "key": "level",
                    "match": "eq",
                    "value": "error"
                },
                "conditionResult": true
            }
        ```

        **Latest Release**
        The event is from the latest release

        ```json
            {
                "type": "latest_release",
                "comparison": true,
                "conditionResult": true
            }
        ```

        **Release Age**
        ```json
            {
                "type": "latest_adopted_release",
                "comparison": {
                    "environment": "12345",
                    "ageComparison": "older",
                    "releaseAgeType": "oldest"
                },
                "conditionResult": true
            }
        ```

        **Event Level**
        The event's level is `match` `level`
        - `match`: The comparison operator
            - `eq`: Equal
            - `gte`: Greater than or equal
            - `lte`: Less than or equal
        - `level`: The event level
            - `50`: Fatal
            - `40`: Error
            - `30`: Warning
            - `20`: Info
            - `10`: Debug
            - `0`: Sample

        ```json
            {
                "type": "level",
                "comparison": {
                    "level": 50,
                    "match": "eq"
                },
                "conditionResult": true
            }
        ```

        ## Actions
        A list of actions that take place when all required conditions and filters for the alert are met. See below for a list of possible actions.


        **Notify on Preferred Channel**
        - `data`: A dictionary with the fallthrough type option when choosing to notify Suggested Assignees. Leave empty if notifying a user or team.
            - `fallthroughType`
                - `ActiveMembers`
                - `AllMembers`
                - `NoOne`
        - `config`: A dictionary with the configuration options for notification.
            - `targetType`: The type of recipient to notify
                - `user`: User
                - `team`: Team
                - `issue_owners`: Suggested Assignees
            - `targetDisplay`: null
            - `targetIdentifier`: The id of the user or team to notify. Leave null for Suggested Assignees.

        ```json
            {
                "type":"email",
                "integrationId":null,
                "data":{},
                "config":{
                    "targetType":"user",
                    "targetDisplay":null,
                    "targetIdentifier":"232692"
                },
                "status":"active"
            },
            {
                "type":"email",
                "integrationId":null,
                "data":{
                    "fallthroughType":"ActiveMembers"
                },
                "config":{
                    "targetType":"issue_owners",
                    "targetDisplay":null,
                    "targetIdentifier":""}
                ,
                "status":"active"
            }
        ```
        **Notify on Slack**
        - `targetDisplay`: The name of the channel to notify in.
        `integrationId`: The stringified ID of the integration.

        ```json
            {
                "type":"slack",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"",
                    "targetDisplay":"notify-errors"
                },
                "integrationId":"1",
                "data":{},
                "status":"active"
            }
        ```

        **Notify on PagerDuty**
        - `targetDisplay`: The name of the service to create the ticket in.
        - `integrationId`: The stringified ID of the integration.
        - `data["priority"]`: The severity level for the notification.

        ```json
            {
                "type":"pagerduty",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"123456",
                    "targetDisplay":"Error Service"
                    },
                "integrationId":"2345",
                "data":{
                    "priority":"default"
                },
                "status":"active"
            }
        ```

        **Notify on Discord**
        - `targetDisplay`: The name of the service to create the ticket in.
        - `integrationId`: The stringified ID of the integration.
        - `data["tags"]`: Comma separated list of tags to add to the notification.

        ```json
            {
                "type":"discord",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"12345",
                    "targetDisplay":"",
                    },
                "integrationId":"1234",
                "data":{
                    "tags":"transaction,environment"
                },
                "status":"active"
            }
        ```

        **Notify on MSTeams**
        - `targetIdentifier` - The integration ID associated with the Microsoft Teams team.
        - `targetDisplay` - The name of the channel to send the notification to.
        - `integrationId`: The stringified ID of the integration.
        ```json
            {
                "type":"msteams",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"19:a4b3kghaghgkjah357y6847@thread.skype",
                    "targetDisplay":"notify-errors"
                },
                "integrationId":"1",
                "data":{},
                "status":"active"
            }
        ```

        **Notify on OpsGenie**
        - `targetDisplay`: The name of the Opsgenie team.
        - `targetIdentifier`: The ID of the Opsgenie team to send the notification to.
        - `integrationId`: The stringified ID of the integration.
        - `data["priority"]`: The priority level for the notification.

        ```json
            {
                "type":"opsgenie",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"123456-Error-Service",
                    "targetDisplay":"Error Service"
                    },
                "integrationId":"2345",
                "data":{
                    "priority":"P3"
                },
                "status":"active"
            }
        ```

        **Notify on Azure DevOps**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"vsts",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a Jira ticket**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"jira",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a Jira Server ticket**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"jira_server",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a GitHub issue**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"github",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```
        """

DATA_SOURCES_HELP_TEXT = """
            The data sources for the monitor to use based on what you want to measure.

            **Number of Errors Metric Monitor**
            ```json
                [
                    {
                        "aggregate": "count()",
                        "dataset" : "events",
                        "environment": "prod",
                        "eventTypes": ["default", "error"],
                        "query": "is:unresolved",
                        "queryType": 0,
                        "timeWindow": 3600,
                    },
                ],
            ```

            **Users Experiencing Errors Metric Monitor**
            ```json
                [
                    {
                        "aggregate": "count_unique(tags[sentry:user])",
                        "dataset" : "events",
                        "environment": "prod",
                        "eventTypes": ["default", "error"],
                        "query": "is:unresolved",
                        "queryType": 0,
                        "timeWindow": 3600,
                    },
                ],
            ```


            **Throughput Metric Monitor**
            ```json
                [
                    {
                        "aggregate":"count(span.duration)",
                        "dataset":"events_analytics_platform",
                        "environment":"prod",
                        "eventTypes":["trace_item_span"]
                        "query":"",
                        "queryType":1,
                        "timeWindow":3600,
                        "extrapolationMode":"unknown",
                    },
                ],
            ```

            **Duration Metric Monitor**
            ```json
                [
                    {
                        "aggregate":"p95(span.duration)",
                        "dataset":"events_analytics_platform",
                        "environment":"prod",
                        "eventTypes":["trace_item_span"]
                        "query":"",
                        "queryType":1,
                        "timeWindow":3600,
                        "extrapolationMode":"unknown",
                    },
                ],
            ```

            **Failure Rate Metric Monitor**
            ```json
                [
                    {
                        "aggregate":"failure_rate()",
                        "dataset":"events_analytics_platform",
                        "environment":"prod",
                        "eventTypes":["trace_item_span"]
                        "query":"",
                        "queryType":1,
                        "timeWindow":3600,
                        "extrapolationMode":"unknown",
                    },
                ],
            ```

            **Largest Contentful Paint Metric Monitor**
            ```json
                [
                    {
                        "aggregate":"p95(measurements.lcp)",
                        "dataset":"events_analytics_platform",
                        "environment":"prod",
                        "eventTypes":["trace_item_span"]
                        "query":"",
                        "queryType":1,
                        "timeWindow":3600,
                        "extrapolationMode":"unknown",
                    },
                ],
            ```
"""

DETECTOR_CONFIG_HELP_TEXT = """
            The issue detection type configuration.


            - `detectionType`
                - `static`: Threshold based monitor
                - `percent`: Change based monitor
                - `dynamic`: Dynamic monitor
            - `comparisonDelta`: If selecting a **change** detection type, the comparison delta is the time period at which to compare against in minutes.
            For example, a value of 3600 compares the metric tracked against data 1 hour ago.
                - `300`: 5 minutes
                - `900`: 15 minutes
                - `3600`: 1 hour
                - `86400`: 1 day
                - `604800`: 1 week
                - `2592000`: 1 month

            **Threshold**
            ```json
            {
                "detectionType": "static",
            }
            ```
            **Change**
            ```json
            {
                "detectionType": "percent",
                "comparisonDelta": 3600,
            }
            ```
            **Dynamic**
            ```json
            {
                "detectionType": "dynamic",
            }
            ```
        """

CONDITION_GROUP_HELP_TEXT = """
            Issue detection configuration for when to create an issue and at what priority level.


            - `logicType`: `any`
            - `type`: Any of `gt` (greater than), `lte` (less than or equal), or `anomaly_detection` (dynamic)
            - `comparison`: Any positive integer. This is threshold that must be crossed for the monitor to create an issue, e.g. "Create a metric issue when there are more than 5 unresolved error events".
                - If creating a **dynamic** monitor, see the options below.
                    - `seasonality`: `auto`
                    - `sensitivity`: Level of responsiveness. Options are one of `low`, `medium`, or `high`
                    - `thresholdType`: If you want to be alerted to anomalies that are moving above, below, or in both directions in relation to your threshold.
                        - `0`: Above
                        - `1`: Below
                        - `2`: Above and below

            - `conditionResult`: The issue state change when the threshold is crossed.
                - `75`: High priority
                - `50`: Low priority
                - `0`: Resolved


            **Threshold and Change Monitor**
            ```json
                "logicType": "any",
                "conditions": [
                    {
                        "type": "gt",
                        "comparison": 10,
                        "conditionResult": 75
                    },
                    {
                        "type": "lte",
                        "comparison": 10,
                        "conditionResult": 0
                    }
                ],
                "actions": []
            ```

            **Threshold Monitor with Medium Priority**
            ```json
                "logicType": "any",
                "conditions": [
                    {
                        type: "gt",
                        comparison: 5,
                        conditionResult: 75
                    },
                    {
                        type: "gt",
                        comparison: 2,
                        conditionResult: 50
                    },
                    {
                        type: "lte",
                        comparison: 2,
                        conditionResult: 0
                    }
                ],
                "actions": []
            ```

            **Dynamic Monitor**
            ```json
                "logicType": "any",
                "conditions": [
                    {
                        "type": "anomaly_detection",
                        "comparison": {
                            "seasonality": "auto",
                            "sensitivity": "medium",
                            "thresholdType": 2
                        },
                        "conditionResult": 75
                    }
                ],
                "actions": []
            ```
        """

OWNER_HELP_TEXT = """
            The user or team who owns the monitor.

            **User**
            ```json
                "type": "user",
                "id": "12345",
                "name": "Jane Doe",
                "email": "jane.doe@sentry.io"
            ```

            **Team**
            ```json
                "type": "team",
                "id": "123456789",
                "name": "example-team"
            ```
        """
