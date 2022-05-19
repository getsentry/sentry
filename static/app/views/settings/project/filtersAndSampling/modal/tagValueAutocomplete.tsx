import {useCallback, useEffect, useState} from 'react';
import {components, MultiValueProps} from 'react-select';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {DynamicSamplingInnerName} from 'sentry/types/dynamicSampling';
import useApi from 'sentry/utils/useApi';

import {TruncatedLabel} from './truncatedLabel';
import {formatCreateTagLabel, getMatchFieldPlaceholder} from './utils';

type Tag = {
  value: string;
};

type Props = {
  category:
    | DynamicSamplingInnerName.EVENT_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_RELEASE
    | DynamicSamplingInnerName.EVENT_TRANSACTION
    | DynamicSamplingInnerName.EVENT_OS_NAME
    | DynamicSamplingInnerName.EVENT_OS_VERSION
    | DynamicSamplingInnerName.EVENT_DEVICE_FAMILY
    | DynamicSamplingInnerName.EVENT_DEVICE_NAME
    | DynamicSamplingInnerName.EVENT_CUSTOM_TAG
    | DynamicSamplingInnerName.TRACE_ENVIRONMENT
    | DynamicSamplingInnerName.TRACE_RELEASE
    | DynamicSamplingInnerName.TRACE_TRANSACTION
    | string;
  onChange: (value: string) => void;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
  tagKey?: string;
  value?: string;
};

function TagValueAutocomplete({
  orgSlug,
  projectId,
  category,
  onChange,
  value,
  tagKey,
}: Props) {
  const api = useApi();
  const [tagValues, setTagValues] = useState<Tag[]>([]);

  function getAriaLabel() {
    switch (category) {
      case DynamicSamplingInnerName.TRACE_RELEASE:
      case DynamicSamplingInnerName.EVENT_RELEASE:
        return t('Search or add a release');
      case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
      case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
        return t('Search or add an environment');
      case DynamicSamplingInnerName.TRACE_TRANSACTION:
      case DynamicSamplingInnerName.EVENT_TRANSACTION:
        return t('Search or add a transaction');
      case DynamicSamplingInnerName.EVENT_OS_NAME:
        return t('Search or add an os name');
      case DynamicSamplingInnerName.EVENT_OS_VERSION:
        return t('Search or add an os version');
      case DynamicSamplingInnerName.EVENT_DEVICE_FAMILY:
        return t('Search or add a device family');
      case DynamicSamplingInnerName.EVENT_DEVICE_NAME:
        return t('Search or add a device name');

      default:
        // custom tags
        return t('Search or add tag values');
    }
  }

  const tagValueLoader = useCallback(async () => {
    if (!tagKey) {
      return;
    }

    try {
      const response = await fetchTagValues(api, orgSlug, tagKey, null, [projectId]);
      setTagValues(response);
    } catch {
      // Do nothing. No results will be suggested
    }
  }, [tagKey, api, orgSlug, projectId]);

  useEffect(() => {
    tagValueLoader();
  }, [tagValueLoader]);

  // react-select doesn't seem to work very well when its value contains
  // a created item that isn't listed in the options
  const createdOptions: Tag[] = !value
    ? []
    : value
        .split('\n')
        .filter(v => !tagValues.some(tagValue => tagValue.value === v))
        .map(v => ({value: v}));

  return (
    <StyledSelectField
      name="match"
      aria-label={getAriaLabel()}
      options={[...createdOptions, ...tagValues].map(tagValue => ({
        value: tagValue.value,
        label: <TruncatedLabel value={tagValue.value} />,
      }))}
      value={value?.split('\n')}
      onChange={newValue => {
        onChange(newValue?.join('\n'));
      }}
      components={{
        MultiValue: (multiValueProps: MultiValueProps<{}>) => (
          <components.MultiValue
            {...multiValueProps}
            innerProps={{...multiValueProps.innerProps, 'data-test-id': 'multivalue'}}
          />
        ),
      }}
      formatCreateLabel={formatCreateTagLabel}
      placeholder={getMatchFieldPlaceholder(category)}
      inline={false}
      multiple
      hideControlState
      flexibleControlStateSize
      required
      stacked
      creatable
      allowClear
    />
  );
}

const StyledSelectField = styled(SelectField)`
  width: 100%;
`;

export {TagValueAutocomplete};
