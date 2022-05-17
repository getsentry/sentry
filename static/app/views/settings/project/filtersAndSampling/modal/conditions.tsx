import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import TextareaField from 'sentry/components/forms/textareaField';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project, Tag} from 'sentry/types';
import {DynamicSamplingInnerName, LegacyBrowser} from 'sentry/types/dynamicSampling';
import useApi from 'sentry/utils/useApi';

import {
  addCustomTagPrefix,
  getInnerNameLabel,
  isCustomTagName,
  stripCustomTagPrefix,
} from '../utils';

import LegacyBrowsers from './legacyBrowsers';
import {TagKeyAutocomplete} from './tagKeyAutocomplete';
import {TagValueAutocomplete} from './tagValueAutocomplete';
import {getMatchFieldPlaceholder, getTagKey} from './utils';

type Condition = {
  category: DynamicSamplingInnerName | string; // string is used for custom tags
  legacyBrowsers?: Array<LegacyBrowser>;
  match?: string;
};

type Props = Pick<
  React.ComponentProps<typeof TagValueAutocomplete>,
  'orgSlug' | 'projectId'
> & {
  conditions: Condition[];
  onChange: <T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) => void;
  onDelete: (index: number) => void;
  projectSlug: Project['slug'];
};

function Conditions({
  conditions,
  orgSlug,
  projectId,
  projectSlug,
  onDelete,
  onChange,
}: Props) {
  const api = useApi();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/tags/`
        );
        setTags(response);
      } catch {
        // Do nothing, just autocomplete won't suggest any results
      }
    }

    fetchTags();
  }, [api, orgSlug, projectSlug]);

  return (
    <Fragment>
      {conditions.map((condition, index) => {
        const {category, match, legacyBrowsers} = condition;
        const displayLegacyBrowsers =
          category === DynamicSamplingInnerName.EVENT_LEGACY_BROWSER;
        const isCustomTag = isCustomTagName(category);

        const isBooleanField =
          category === DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
          category === DynamicSamplingInnerName.EVENT_LOCALHOST ||
          category === DynamicSamplingInnerName.EVENT_WEB_CRAWLERS;
        displayLegacyBrowsers;

        const isAutoCompleteField =
          category === DynamicSamplingInnerName.EVENT_ENVIRONMENT ||
          category === DynamicSamplingInnerName.EVENT_RELEASE ||
          category === DynamicSamplingInnerName.EVENT_TRANSACTION ||
          category === DynamicSamplingInnerName.EVENT_OS_NAME ||
          category === DynamicSamplingInnerName.EVENT_DEVICE_FAMILY ||
          category === DynamicSamplingInnerName.EVENT_DEVICE_NAME ||
          category === DynamicSamplingInnerName.TRACE_ENVIRONMENT ||
          category === DynamicSamplingInnerName.TRACE_RELEASE ||
          category === DynamicSamplingInnerName.TRACE_TRANSACTION ||
          isCustomTag;

        return (
          <ConditionWrapper key={index}>
            <LeftCell>
              {isCustomTag ? (
                <TagKeyAutocomplete
                  tags={tags}
                  onChange={value =>
                    onChange(index, 'category', addCustomTagPrefix(value))
                  }
                  value={stripCustomTagPrefix(category)}
                  disabledOptions={conditions
                    .filter(
                      cond => isCustomTagName(cond.category) && cond.category !== category
                    )
                    .map(cond => stripCustomTagPrefix(cond.category))}
                />
              ) : (
                <span>
                  {getInnerNameLabel(category)}
                  <FieldRequiredBadge />
                </span>
              )}
            </LeftCell>
            <CenterCell>
              {!isBooleanField &&
                (isAutoCompleteField ? (
                  <TagValueAutocomplete
                    category={category}
                    tagKey={getTagKey(condition)}
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
                    placeholder={getMatchFieldPlaceholder(category)}
                    inline={false}
                    rows={1}
                    autosize
                    hideControlState
                    flexibleControlStateSize
                    required
                    stacked
                  />
                ))}
            </CenterCell>
            <RightCell>
              <Button
                onClick={() => onDelete(index)}
                icon={<IconDelete />}
                aria-label={t('Delete Condition')}
              />
            </RightCell>
            {displayLegacyBrowsers && (
              <LegacyBrowsers
                selectedLegacyBrowsers={legacyBrowsers}
                onChange={value => {
                  onChange(index, 'legacyBrowsers', value);
                }}
              />
            )}
          </ConditionWrapper>
        );
      })}
    </Fragment>
  );
}

export default Conditions;

const ConditionWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr minmax(0, 1fr);
  align-items: flex-start;
  padding: ${space(1)} ${space(2)};
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.gray100};
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 0.6fr minmax(0, 1fr) max-content;
  }
`;

const Cell = styled('div')`
  min-height: 40px;
  display: inline-flex;
  align-items: center;
`;

const LeftCell = styled(Cell)`
  padding-right: ${space(2)};
  line-height: 16px;
`;

const CenterCell = styled(Cell)`
  padding-top: ${space(1)};
  grid-column: 1/-1;
  grid-row: 2/2;
  ${p => !p.children && 'display: none'};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
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
