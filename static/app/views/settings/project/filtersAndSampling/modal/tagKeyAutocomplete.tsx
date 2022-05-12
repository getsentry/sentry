import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Organization, Project, Tag} from 'sentry/types';
import {DynamicSamplingInnerName} from 'sentry/types/dynamicSampling';
import useApi from 'sentry/utils/useApi';

type Props = {
  onChange: (value: string) => void;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  value?: string;
};

/**
 * This component is used for the autocomplete of custom tag key
 */
function TagKeyAutocomplete({onChange, orgSlug, projectSlug, value}: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const api = useApi();

  const fetchProjectTags = useCallback(async () => {
    try {
      // TODO(sampling): cache this request so that it's not called for every custom tag condition
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/tags/`
      );
      setTags(response);
    } catch {
      // Do nothing, just autocomplete won't suggest any results
    }
  }, [api, orgSlug, projectSlug]);

  useEffect(() => {
    fetchProjectTags();
  }, [fetchProjectTags]);

  // select doesn't play nicely with selected values that are not in the listed options
  const options = tags.map(({key}) => ({value: key, label: key}));
  if (
    value &&
    value !== DynamicSamplingInnerName.EVENT_CUSTOM_TAG &&
    !tags.some(({key}) => key === value)
  ) {
    options.push({value, label: value});
  }

  return (
    <Wrapper>
      <SelectField
        name="customTagKey"
        options={options}
        inline={false}
        stacked
        hideControlState
        required
        creatable
        placeholder={t('tag')}
        onChange={onChange}
        value={value}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  width: 100%;
`;

export {TagKeyAutocomplete};
