import {useEffect, useState} from 'react';
import {components, MultiValueProps, OptionProps} from 'react-select';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SelectField from 'sentry/components/forms/selectField';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {DynamicSamplingInnerName} from 'sentry/types/dynamicSampling';
import useApi from 'sentry/utils/useApi';

import {getMatchFieldPlaceholder} from './utils';

// react-select doesn't seem to expose ContainerProps
type ContainerProps = React.ComponentProps<typeof components.SelectContainer>;

type Tag = {
  value: string;
};

type Props = {
  category:
    | DynamicSamplingInnerName.TRACE_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_RELEASE
    | DynamicSamplingInnerName.TRACE_RELEASE
    | DynamicSamplingInnerName.TRACE_TRANSACTION
    | DynamicSamplingInnerName.EVENT_TRANSACTION;
  onChange: (value: string) => void;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
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
      default:
        Sentry.captureException(
          new Error('Unknown dynamic sampling condition inner name')
        );
        return ''; // this shall never happen
    }
  }

  const key = getTagKey();

  async function tagValueLoader() {
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
      aria-label={getAriaLabel()}
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
      components={{
        SelectContainer: (containerProps: ContainerProps) => (
          <components.SelectContainer
            {...containerProps}
            innerProps={
              {
                ...containerProps.innerProps,
                'data-test-id': `autocomplete-${key}`,
              } as ContainerProps['innerProps']
            }
          />
        ),
        MultiValue: (multiValueProps: MultiValueProps<{}>) => (
          <components.MultiValue
            {...multiValueProps}
            innerProps={{...multiValueProps.innerProps, 'data-test-id': 'multivalue'}}
          />
        ),
        Option: (optionProps: OptionProps<{}>) => (
          <components.Option
            {...optionProps}
            innerProps={
              {
                ...optionProps.innerProps,
                'data-test-id': 'option',
              } as OptionProps<{}>['innerProps']
            }
          />
        ),
      }}
      formatCreateLabel={label => tct('Add "[newLabel]"', {newLabel: label})}
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

export default AutoComplete;

const StyledSelectField = styled(SelectField)`
  width: 100%;
`;
