import {components, MultiValueProps} from 'react-select';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import Count from 'sentry/components/count';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import type {Organization, Project, TagValue as IssueTagValue} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';
import useApi from 'sentry/utils/useApi';

import {TruncatedLabel} from './truncatedLabel';
import {formatCreateTagLabel, getMatchFieldPlaceholder} from './utils';

type TagValue = Pick<
  IssueTagValue,
  'key' | 'name' | 'value' | 'count' | 'lastSeen' | 'firstSeen'
>;

export interface TagValueAutocompleteProps {
  category: SamplingInnerName.TRACE_ENVIRONMENT | SamplingInnerName.TRACE_RELEASE;
  onChange: (value: string) => void;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
  tagKey?: string;
  value?: string;
}

function TagValueAutocomplete({
  orgSlug,
  projectId,
  category,
  onChange,
  value,
  tagKey,
}: TagValueAutocompleteProps) {
  const api = useApi();

  function getAriaLabel() {
    switch (category) {
      case SamplingInnerName.TRACE_RELEASE:
        return t('Search or add a release');
      case SamplingInnerName.TRACE_ENVIRONMENT:
        return t('Search or add an environment');
      default:
        return undefined;
    }
  }

  const debouncedFetchValues = debounce(async (inputValue, resolve) => {
    if (!tagKey) {
      return resolve([]);
    }

    return resolve(
      await fetchTagValues(
        api,
        orgSlug,
        tagKey,
        inputValue,
        [projectId],
        null,
        true,
        undefined,
        '-count'
      )
    );
  }, 250);

  const loadOptions = async (inputValue: string) => {
    const response: TagValue[] = await new Promise(resolve => {
      debouncedFetchValues(inputValue, resolve);
    });
    // react-select doesn't seem to work very well when its value contains
    // a created item that isn't listed in the options
    const createdOptions: TagValue[] = value
      ? value
          .split('\n')
          .filter(v => !response.some(tagValue => tagValue.value === v))
          .map(v => ({
            value: v,
            name: v,
            key: tagKey,
            count: 0,
            firstSeen: '',
            lastSeen: '',
          }))
      : [];

    return [...response, ...createdOptions].map(tagValue => ({
      value: tagValue.value,
      label: <TruncatedLabel value={tagValue.value} />,
      trailingItems: <StyledCount value={tagValue.count} />,
    }));
  };

  return (
    <StyledSelectField
      name="match"
      // The key is used as a way to force a reload of the options:
      // https://github.com/JedWatson/react-select/issues/1879#issuecomment-316871520
      key={tagKey}
      aria-label={getAriaLabel()}
      value={value ? value?.split('\n').map(v => ({value: v, label: v})) : []}
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
      isValidNewOption={(inputValue, _selectValue, optionsArray) => {
        // Do not show "Add new" for existing options
        if (optionsArray.some(option => option.value === inputValue)) {
          return false;
        }
        // Tag values cannot be empty and must have a maximum length of 200 characters
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/store/normalize.rs#L230-L236
        // In addition to that, it cannot contain a line-feed (newline) character
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/protocol/tags.rs#L8
        return (
          !/\\n/.test(inputValue) &&
          inputValue.trim().length > 0 &&
          inputValue.trim().length <= 200
        );
      }}
      filterOption={(option, filterText) => option.data.value.indexOf(filterText) > -1}
      placeholder={getMatchFieldPlaceholder(category)}
      inline={false}
      multiple
      hideControlState
      flexibleControlStateSize
      required
      stacked
      creatable
      allowClear
      async
      cacheOptions
      defaultOptions
      loadOptions={loadOptions}
    />
  );
}

const StyledSelectField = styled(SelectField)`
  width: 100%;
`;

const StyledCount = styled(Count)`
  color: ${p => p.theme.subText};
`;

export {TagValueAutocomplete};
