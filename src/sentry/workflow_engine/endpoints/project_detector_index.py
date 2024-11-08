# def validate_group_type(self, value: str) -> GroupType:
#     detector_type = grouptype.registry.get_by_slug(value)
#     if detector_type is None:
#         raise serializers.ValidationError("Unknown group type")
#     if detector_type.detector_validator is None:
#         raise serializers.ValidationError("Group type not compatible with detectors")
#     # TODO: Probably need to check a feature flag to decide if a given
#     # org/user is allowed to add a detector
#     return detector_type
