class SearchResolverConfig:
    # Automatically add id, etc. if there are no aggregates
    auto_fields: bool = False
    # Ignore aggregate conditions, if false the query will run but not use any aggregate conditions
    use_aggregate_conditions: bool = True
    # TODO: do we need parser_config_overrides? it looks like its just for alerts
    # Whether to process the results from snuba
    process_results: bool = True
