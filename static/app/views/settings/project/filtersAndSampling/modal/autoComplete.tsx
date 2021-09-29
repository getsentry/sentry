import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {fetchTagValues} from 'app/actionCreators/tags';
import {tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {DynamicSamplingInnerName} from 'app/types/dynamicSampling';
import useApi from 'app/utils/useApi';
import SelectField from 'app/views/settings/components/forms/selectField';

import {getMatchFieldPlaceholder} from './utils';

type Tag = {
  value: string;
};

type Props = {
  projectId: Project['id'];
  orgSlug: Organization['slug'];
  category:
    | DynamicSamplingInnerName.TRACE_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_RELEASE
    | DynamicSamplingInnerName.TRACE_RELEASE
    | DynamicSamplingInnerName.TRACE_TRANSACTION
    | DynamicSamplingInnerName.EVENT_TRANSACTION;
  onChange: (value: string) => void;
  value?: string;
};

function AutoComplete({orgSlug, projectId, category, onChange, value}: Props) {
  const api = useApi();
  const [tagValues, setTagValues] = useState<Tag[]>([]);

  useEffect(() => {
    tagValueLoader();
  }, []);

  function getTagKey() {
    switch (category) {
      case DynamicSamplingInnerName.TRACE_RELEASE:
      case DynamicSamplingInnerName.EVENT_RELEASE:
        return 'release';
      case DynamicSamplingInnerName.TRACE_ENVIRONMENT:
      case DynamicSamplingInnerName.EVENT_ENVIRONMENT:
        return 'environment';
      case DynamicSamplingInnerName.TRACE_TRANSACTION:
      case DynamicSamplingInnerName.EVENT_TRANSACTION:
        return 'transaction';
      default:
        Sentry.captureException(
          new Error('Unknown dynamic sampling condition inner name')
        );
        return ''; // this shall never happen
    }
  }

  async function tagValueLoader() {
    const key = getTagKey();

    if (!key) {
      return;
    }

    try {
      const response = await fetchTagValues(api, orgSlug, key, null, [projectId]);
      setTagValues(response);
    } catch {
      // Do nothing. No results will be suggested
    }
  }

  // react-select doesn't seem to work very well when its value contains
  // a created item that isn't listed in the options
  const createdOptions: Tag[] = !value
    ? []
    : value
        .split(',')
        .filter(v => !tagValues.some(tagValue => tagValue.value === v))
        .map(v => ({value: v}));

  return (
    <StyledSelectField
      name="match"
      multiple
      options={[...createdOptions, ...tagValues].map(tagValue => ({
        value: tagValue.value,
        label: tagValue.value,
      }))}
      value={value?.split(',')}
      onChange={newValue => {
        onChange(newValue?.join(','));
      }}
      styles={{
        menu: provided => ({
          ...provided,
          wordBreak: 'break-all',
        }),
      }}
      formatCreateLabel={label => tct('Add "[newLabel]"', {newLabel: label})}
      placeholder={getMatchFieldPlaceholder(category)}
      inline={false}
      hideControlState
      flexibleControlStateSize
      required
      stacked
      creatable
    />
  );
}

export default AutoComplete;

const StyledSelectField = styled(SelectField)`
  width: 100%;
`;
