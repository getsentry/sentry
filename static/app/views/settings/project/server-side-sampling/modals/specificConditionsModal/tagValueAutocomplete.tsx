import {useCallback, useEffect, useState} from 'react';
import {components, MultiValueProps} from 'react-select';
import styled from '@emotion/styled';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import Count from 'sentry/components/count';
import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Organization, Project, TagValue as IssueTagValue} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';
import useApi from 'sentry/utils/useApi';

import {TruncatedLabel} from './truncatedLabel';
import {formatCreateTagLabel, getMatchFieldPlaceholder} from './utils';

type TagValue = Pick<
  IssueTagValue,
  'key' | 'name' | 'value' | 'count' | 'lastSeen' | 'firstSeen'
>;

export interface TagValueAutocompleteProps {
  category:
    | SamplingInnerName.TRACE_ENVIRONMENT
    | SamplingInnerName.TRACE_RELEASE
    | string;
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
  const [tagValues, setTagValues] = useState<TagValue[]>([]);

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
        true,
        undefined,
        '-count'
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
  const createdOptions: TagValue[] = !value
    ? []
    : value
        .split('\n')
        .filter(v => !tagValues.some(tagValue => tagValue.value === v))
        .map(v => ({
          value: v,
          name: v,
          key: tagKey,
          count: 0,
          firstSeen: '',
          lastSeen: '',
        }));

  return (
    <StyledSelectField
      name="match"
      aria-label={getAriaLabel()}
      options={[...tagValues, ...createdOptions].map(tagValue => ({
        value: tagValue.value,
        label: <TruncatedLabel value={tagValue.value} />,
        trailingItems: <StyledCount value={tagValue.count} />,
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
        if (tagValues.some(tagValue => tagValue.value === newOption)) {
          return false;
        }
        // Tag values cannot be empty and must have a maximum length of 200 characters
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/store/normalize.rs#L230-L236
        // In addition to that, it cannot contain a line-feed (newline) character
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/protocol/tags.rs#L8
        return (
          !/\\n/.test(newOption) &&
          newOption.trim().length > 0 &&
          newOption.trim().length <= 200
        );
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

const StyledCount = styled(Count)`
  color: ${p => p.theme.subText};
`;

export {TagValueAutocomplete};
