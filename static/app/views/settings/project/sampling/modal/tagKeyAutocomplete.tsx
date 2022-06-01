import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';
import {Tag} from 'sentry/types';
import {SamplingInnerName} from 'sentry/types/sampling';

import {TruncatedLabel} from './truncatedLabel';
import {formatCreateTagLabel} from './utils';

type Props = {
  disabledOptions: string[];
  onChange: (value: string) => void;
  tags: Tag[];
  value?: string;
};

/**
 * This component is used for the autocomplete of custom tag key
 */
function TagKeyAutocomplete({tags, onChange, value, disabledOptions}: Props) {
  // select doesn't play nicely with selected values that are not in the listed options
  const options = tags.map(({key}) => ({
    value: key,
    label: <TruncatedLabel value={key} />,
  }));

  if (
    value &&
    value !== SamplingInnerName.EVENT_CUSTOM_TAG &&
    !tags.some(({key}) => key === value)
  ) {
    options.push({
      value,
      label: <TruncatedLabel value={value} />,
    });
  }

  return (
    <Wrapper>
      <SelectField
        name="customTagKey"
        options={options}
        isOptionDisabled={option => disabledOptions.includes(option.value)}
        inline={false}
        stacked
        hideControlState
        required
        creatable
        placeholder={t('tag')}
        onChange={onChange}
        value={value}
        formatCreateLabel={formatCreateTagLabel}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  width: 100%;
`;

export {TagKeyAutocomplete};
