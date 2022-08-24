import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import TextareaField from 'sentry/components/forms/textareaField';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {FeatureFlagSegmentTagKind} from 'sentry/types/featureFlags';

import {TagKeyAutocomplete} from './tagKeyAutocomplete';
import {TagValueAutocomplete, TagValueAutocompleteProps} from './tagValueAutocomplete';
import {getInnerNameLabel, getMatchFieldPlaceholder, getTagKey} from './utils';

export type Tag = {
  category: FeatureFlagSegmentTagKind | string;
  match?: string;
  tagKey?: string;
};

interface Props extends Pick<TagValueAutocompleteProps, 'orgSlug' | 'projectId'> {
  onChange: <T extends keyof Tag>(index: number, field: T, value: Tag[T]) => void;
  onDelete: (index: number) => void;
  projectSlug: Project['slug'];
  tags: Tag[];
}

export function Tags({tags, orgSlug, projectId, projectSlug, onDelete, onChange}: Props) {
  return (
    <Fragment>
      {tags.map((tag, index) => {
        const {category, tagKey, match} = tag;

        const isAutoCompleteField =
          category === FeatureFlagSegmentTagKind.ENVIRONMENT ||
          category === FeatureFlagSegmentTagKind.RELEASE;

        const isCustomTag = category === FeatureFlagSegmentTagKind.CUSTOM;

        return (
          <TagWrapper key={index}>
            <LeftCell>
              {isCustomTag ? (
                <TagKeyAutocomplete
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  onChange={value => onChange(index, 'tagKey', value)}
                  value={tagKey}
                />
              ) : (
                <span>
                  {getInnerNameLabel(category as FeatureFlagSegmentTagKind)}
                  <FieldRequiredBadge />
                </span>
              )}
            </LeftCell>
            <CenterCell>
              {isAutoCompleteField ? (
                <TagValueAutocomplete
                  category={category}
                  tagKey={getTagKey(tag)}
                  orgSlug={orgSlug}
                  projectId={projectId}
                  value={match}
                  onChange={value => onChange(index, 'match', value)}
                />
              ) : (
                <StyledTextareaField
                  name="match"
                  value={match}
                  onChange={value => onChange(index, 'match', value)}
                  placeholder={getMatchFieldPlaceholder(
                    category as FeatureFlagSegmentTagKind
                  )}
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
                aria-label={t('Delete Tag')}
              />
            </RightCell>
          </TagWrapper>
        );
      })}
    </Fragment>
  );
}

const TagWrapper = styled('div')`
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
