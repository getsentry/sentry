import {useCallback, useEffect, useState} from 'react';
import {components, MultiValueProps} from 'react-select';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';
import useApi from 'sentry/utils/useApi';

import {TruncatedLabel} from './truncatedLabel';
import {formatCreateTagLabel, getMatchFieldPlaceholder} from './utils';

type Tag = {
  value: string;
};

type Props = {
  category:
    | SamplingInnerName.EVENT_ENVIRONMENT
    | SamplingInnerName.EVENT_RELEASE
    | SamplingInnerName.EVENT_TRANSACTION
    | SamplingInnerName.EVENT_OS_NAME
    | SamplingInnerName.EVENT_OS_VERSION
    | SamplingInnerName.EVENT_DEVICE_FAMILY
    | SamplingInnerName.EVENT_DEVICE_NAME
    | SamplingInnerName.EVENT_CUSTOM_TAG
    | SamplingInnerName.TRACE_ENVIRONMENT
    | SamplingInnerName.TRACE_RELEASE
    | SamplingInnerName.TRACE_TRANSACTION
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
      case SamplingInnerName.TRACE_RELEASE:
      case SamplingInnerName.EVENT_RELEASE:
        return t('Search or add a release');
      case SamplingInnerName.TRACE_ENVIRONMENT:
      case SamplingInnerName.EVENT_ENVIRONMENT:
        return t('Search or add an environment');
      case SamplingInnerName.TRACE_TRANSACTION:
      case SamplingInnerName.EVENT_TRANSACTION:
        return t('Search or add a transaction');
      case SamplingInnerName.EVENT_OS_NAME:
        return t('Search or add an os name');
      case SamplingInnerName.EVENT_OS_VERSION:
        return t('Search or add an os version');
      case SamplingInnerName.EVENT_DEVICE_FAMILY:
        return t('Search or add a device family');
      case SamplingInnerName.EVENT_DEVICE_NAME:
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
      const response = await fetchTagValues(
        api,
        orgSlug,
        tagKey,
        null,
        [projectId],
        null,
        true
      );
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
      isValidNewOption={newOption => {
        // Tag values cannot be empty and must have a maximum length of 200 characters
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/store/normalize.rs#L230-L236
        // In addition to that, it cannot contain a line-feed (newline) character
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/protocol/tags.rs#L8
        return !/\\n/.test(newOption) && newOption.length <= 200;
      }}
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
