import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Highlight from 'app/components/highlight';
import TextOverflow from 'app/components/textOverflow';
import {IconChevron, IconClose} from 'app/icons';
import {t} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';

import {Metric, MetricQuery} from './types';

type Props = {
  onChange: (groupBy: MetricQuery['groupBy']) => void;
  tags?: Metric['tags'];
  groupBy?: MetricQuery['groupBy'];
};

function GroupByField({tags = [], groupBy = [], onChange}: Props) {
  const hasSelected = !!groupBy.length;

  function handleClick(tag: Metric['tags'][0]) {
    if (groupBy.includes(tag)) {
      onChange(groupBy.filter(groupByOption => groupByOption !== tag));
    }
    onChange([...groupBy, tag]);
  }

  function handleUnselectAll() {
    onChange([]);
  }

  return (
    <DropdownAutoComplete
      searchPlaceholder={t('Search tag')}
      items={tags.map(tag => ({
        value: tag,
        searchKey: tag,
        label: ({inputValue}) => (
          <Item onClick={() => handleClick(tag)}>
            <Highlight text={inputValue}>{tag}</Highlight>
            <CheckboxFancy isChecked={groupBy.includes(tag)} />
          </Item>
        ),
      }))}
    >
      {({isOpen, getActorProps}) => (
        <Field {...getActorProps()} isOpen={isOpen}>
          {!hasSelected ? (
            <Placeholder>{t('Group by')}</Placeholder>
          ) : (
            <React.Fragment>
              <TextOverflow>
                {groupBy.map(groupByOption => groupByOption).join(',')}
              </TextOverflow>
              <StyledClose
                color={hasSelected ? 'textColor' : 'gray300'}
                onClick={handleUnselectAll}
              />
            </React.Fragment>
          )}
          <ChevronWrapper>
            <IconChevron
              direction={isOpen ? 'up' : 'down'}
              size="sm"
              color={isOpen ? 'textColor' : 'gray300'}
            />
          </ChevronWrapper>
        </Field>
      )}
    </DropdownAutoComplete>
  );
}

export default GroupByField;

const Field = styled('div')<{isOpen: boolean}>`
  ${p => inputStyles(p)};
  min-width: 250px;
  display: flex;
  align-items: center;
  ${p =>
    p.isOpen &&
    `
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    `}
`;

const Item = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1.5)};
  word-break: break-all;
`;

const ChevronWrapper = styled('div')`
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: ${space(1)};
`;

const StyledClose = styled(IconClose)`
  height: 10px;
  width: 10px;
  padding: ${space(1)} 0;
  stroke-width: 1.5;
  margin-left: ${space(1)};
  box-sizing: content-box;
`;

const Placeholder = styled('div')`
  flex: 1;
  color: ${p => p.theme.gray200};
  padding: 0 ${space(0.25)};
`;
