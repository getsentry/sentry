import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useValidatedExploreColumns} from 'sentry/views/explore/hooks/useValidatedExploreColumns';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';

export function useValidatedSpansTabColumns(tab: Mode | Tab) {
  const organization = useOrganization();
  // Array attributes are gated behind the array feature flag. When it's off the
  // fetch is disabled, so the collection stays empty and nothing else changes.
  const supportsArrays = organization.features.includes('trace-item-array-query-support');

  const {attributes: numberAttributes} = useSpanItemAttributes({}, 'number');
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');
  const {attributes: arrayAttributes} = useSpanItemAttributes(
    {enabled: supportsArrays},
    'array'
  );
  const {data: validationData, isFetching: isValidatingColumns} = useValidateSpansTab({
    enabled: tab === Tab.SPAN || tab === Mode.AGGREGATE,
  });
  const validatedColumnData = useValidatedExploreColumns({
    attributes: {
      boolean: booleanAttributes,
      number: numberAttributes,
      string: stringAttributes,
      array: arrayAttributes,
    },
    isValidating: isValidatingColumns,
    shouldCleanupAggregateColumns: tab === Mode.AGGREGATE,
    shouldCleanupColumns: tab === Tab.SPAN,
    validationData,
  });

  return {...validatedColumnData, isValidatingColumns};
}
