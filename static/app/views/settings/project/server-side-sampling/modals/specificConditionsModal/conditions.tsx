import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SamplingInnerName} from 'sentry/types/sampling';

import {getInnerNameLabel} from '../../utils';

import {TagValueAutocomplete, TagValueAutocompleteProps} from './tagValueAutocomplete';
import {getMatchFieldAriaLabel, getMatchFieldPlaceholder, getTagKey} from './utils';

export type Condition = {
  category: SamplingInnerName;
  match?: string;
};

interface Props extends Pick<TagValueAutocompleteProps, 'orgSlug' | 'projectId'> {
  conditions: Condition[];
  onChange: <T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) => void;
  onDelete: (index: number) => void;
}

export function Conditions({conditions, orgSlug, projectId, onDelete, onChange}: Props) {
  return (
    <Fragment>
      {conditions.map((condition, index) => {
        const {category, match} = condition;

        const isAutoCompleteField =
          category === SamplingInnerName.TRACE_ENVIRONMENT ||
          category === SamplingInnerName.TRACE_RELEASE;

        return (
          <ConditionWrapper key={index}>
            <LeftCell>
              <span>
                {getInnerNameLabel(category)}
                <FieldRequiredBadge />
              </span>
            </LeftCell>
            <CenterCell>
              {isAutoCompleteField ? (
                <TagValueAutocomplete
                  tagKey={getTagKey(condition)}
                  orgSlug={orgSlug}
                  projectId={projectId}
                  value={match}
                  onChange={value => onChange(index, 'match', value)}
                  placeholder={getMatchFieldPlaceholder(category)}
                  ariaLabel={getMatchFieldAriaLabel(category)}
                  prependOptions={
                    category === SamplingInnerName.TRACE_RELEASE
                      ? [{value: 'latest', label: t('Latest Release(s)')}]
                      : []
                  }
                />
              ) : (
                <StyledTextareaField
                  name="match"
                  value={match}
                  onChange={value => onChange(index, 'match', value)}
                  placeholder={getMatchFieldPlaceholder(category)}
                  inline={false}
                  rows={1}
                  autosize
                  hideControlState
                  flexibleControlStateSize
                  required
                  stacked
                />
              )}
            </CenterCell>
            <RightCell>
              <Button
                onClick={() => onDelete(index)}
                icon={<IconDelete />}
                aria-label={t('Delete Condition')}
              />
            </RightCell>
          </ConditionWrapper>
        );
      })}
    </Fragment>
  );
}

const ConditionWrapper = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: flex-start;
  padding: ${space(1)} ${space(2)};
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.gray100};
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr) max-content;
  }
`;

const Cell = styled('div')`
  min-height: 40px;
  display: inline-flex;
  align-items: center;
`;

const LeftCell = styled(Cell)`
  padding-right: ${space(1)};
  line-height: 16px;
`;

const CenterCell = styled(Cell)`
  padding-top: ${space(1)};
  grid-column: 1/-1;
  grid-row: 2/2;
  ${p => !p.children && 'display: none'};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: auto;
    grid-row: auto;
    padding-top: 0;
  }
`;

const RightCell = styled(Cell)`
  justify-content: flex-end;
  padding-left: ${space(1)};
`;

const StyledTextareaField = styled(TextareaField)`
  padding-bottom: 0;
  width: 100%;
`;
