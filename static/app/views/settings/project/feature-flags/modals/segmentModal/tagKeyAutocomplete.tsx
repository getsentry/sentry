import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Organization, Project, Tag} from 'sentry/types';
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
export function TagKeyAutocomplete({onChange, orgSlug, projectSlug, value}: Props) {
  const [tags, setTags] = useState<Tag[]>(value ? [{key: value, name: value}] : []);
  const api = useApi();

  const fetchProjectTags = useCallback(async () => {
    try {
      // TODO(feature-flags): cache this request so that it's not called for every custom tag condition
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

  useEffect(() => {
    if (!tags.some(tag => tag.key === value) && value) {
      setTags([...tags, {key: value, name: value}]);
    }
  }, [value, tags]);

  return (
    <Wrapper>
      <SelectField
        name="customTagKey"
        options={tags.map(({key}) => ({value: key, label: key}))}
        inline={false}
        stacked
        hideControlState
        required
        creatable
        onKeyDown={(val: string, e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            onChange(val);
          }
        }}
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
