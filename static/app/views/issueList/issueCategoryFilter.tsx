import React, {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

function IssueCategoryFilter() {
  const items: SelectOption<string>[] = [
    {label: t('All Categories'), value: 'all_categories', textValue: 'all_categories'},
    {label: t('Errors'), value: 'error', textValue: 'error'},
    {label: t('Performance'), value: 'performance', textValue: 'performance'},
  ];
  const [selectedValue, setSelectedValue] = useState<SelectOption<string>>(items[0]);

  const handleChange = option => setSelectedValue(option);

  return (
    <React.Fragment>
      <CompactSelect
        options={items}
        value={selectedValue.value}
        triggerLabel={
          <React.Fragment>
            <Icon /> {selectedValue.label}
          </React.Fragment>
        }
        onChange={handleChange}
        menuWidth={250}
        size="md"
      />
    </React.Fragment>
  );
}

const Icon = styled(IconStack)`
  margin-right: ${space(1)};
`;

export default IssueCategoryFilter;
