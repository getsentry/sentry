class DataConditionEvaluation:
    pass


class DataConditionGroupEvaluation:
    pass


class EvaluationResult:
    # TODO WorkflowEvaluation or DetectorEvaluation? Base of both?
    pass


"""
Next Steps...

1. Implement these base classes
    - Should these be models or types?
    - Should there be a DataCondition Evaluation or just Group?
    - Can these replace other types / artifacts?

2. Implement EAP items
    - Determine how we can do this locally
    - Determine if we can use eap-items or if it needs to be a custom dataset
    - Are there any scaling concerns?
    - Verify the data is stored / fetched as expected

--- at this point, the system is "working" ---

3. Update `process_workflows` to use the new evaluation results

4. Update `delayed_processing` to use the new results
    - How can we map delayed conditions to processing_workflows?

5. Update `process_detectors` to use the evaluation results
    - look at introducing the `DetectorEvaluation`
    - are there any key differences that require a new base class?
"""
