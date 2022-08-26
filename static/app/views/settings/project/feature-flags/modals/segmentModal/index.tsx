import {Fragment, useState} from 'react';
import {components, createFilter} from 'react-select';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {BooleanField, NumberField, TextField} from 'sentry/components/forms';
import CompactSelect from 'sentry/components/forms/compactSelect';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Slider from 'sentry/components/forms/controls/rangeSlider/slider';
import Field from 'sentry/components/forms/field';
import FieldDescription from 'sentry/components/forms/field/fieldDescription';
import SelectField from 'sentry/components/forms/selectField';
import Option from 'sentry/components/forms/selectOption';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {
  EvaluationType,
  FeatureFlagKind,
  FeatureFlags,
  FeatureFlagSegment,
  FeatureFlagSegmentTagKind,
} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import {isCustomTag} from '../../utils';

import {Tag, Tags} from './tags';
import {
  generateTagCategoriesOptions,
  percentageToRate,
  rateToPercentage,
  validResultValue,
} from './utils';

type State = {
  tags: Tag[];
  type: FeatureFlagSegment['type'];
  percentage?: FeatureFlagSegment['percentage'];
  result?: FeatureFlagSegment['result'];
};

type Props = ModalRenderProps & {
  flagKey: string;
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  segmentIndex?: number;
};

export function SegmentModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  segmentIndex,
  flags,
  flagKey,
  organization,
}: Props) {
  const api = useApi();
  const [data, setData] = useState<State>(getInitialState());
  const [isSaving, setIsSaving] = useState(false);

  const tagCategories = generateTagCategoriesOptions([
    FeatureFlagSegmentTagKind.RELEASE,
    FeatureFlagSegmentTagKind.ENVIRONMENT,
    FeatureFlagSegmentTagKind.TRANSACTION,
    FeatureFlagSegmentTagKind.CUSTOM,
  ]);

  function getInitialState(): State {
    if (defined(segmentIndex)) {
      const segment = flags[flagKey].evaluation[segmentIndex];

      return {
        type: segment.type,
        tags: Object.entries(segment.tags ?? {}).map(([key, value]) => {
          const customTag = isCustomTag(key);
          return {
            category: customTag ? FeatureFlagSegmentTagKind.CUSTOM : key,
            match: Array.isArray(value) ? value.join('\n') : value,
            ...(customTag && {tagKey: key}),
          };
        }),
        result:
          flags[flagKey].kind === FeatureFlagKind.RATE
            ? rateToPercentage(typeof segment.result === 'number' ? segment.result : 0.0)
            : segment.result,
        percentage: defined(segment.percentage)
          ? rateToPercentage(segment.percentage)
          : 0,
      };
    }

    return {
      type: EvaluationType.Match,
      tags: [],
      percentage: 0,
      result:
        flags[flagKey].kind === FeatureFlagKind.BOOLEAN
          ? true
          : flags[flagKey].kind === FeatureFlagKind.RATE
          ? 0.5
          : undefined,
    };
  }

  async function handleSubmit() {
    if (!defined(data.result)) {
      return;
    }

    setIsSaving(true);

    const newTags = data.tags.reduce((acc, tag) => {
      if (acc[tag.category]) {
        return acc;
      }

      const tagMatch = (tag.match ?? '')
        .split('\n')
        .filter(match => !!match.trim())
        .map(match => match.trim());

      const value = tagMatch.length === 1 ? tagMatch[0] : tagMatch;

      if (tag.category === FeatureFlagSegmentTagKind.CUSTOM && tag.tagKey) {
        acc[tag.tagKey] = value;
        return acc;
      }

      acc[tag.category] = value;

      return acc;
    }, {} as Record<string, string | string[]>);

    const newFeatureFlags = {
      ...flags,
      [flagKey]: {
        ...flags[flagKey],
        evaluation: flags[flagKey].evaluation,
      },
    };

    const newSegment: FeatureFlagSegment = {
      type: data.type,
      tags: newTags,
      result:
        flags[flagKey].kind === FeatureFlagKind.RATE
          ? percentageToRate(data.result as number)!
          : data.result,
      id: flags[flagKey].evaluation.length + 1,
    };

    if (data.type === EvaluationType.Rollout) {
      newSegment.percentage = percentageToRate(data.percentage);
    }

    if (defined(segmentIndex)) {
      newSegment.id = flags[flagKey].evaluation[segmentIndex].id;
      newFeatureFlags[flagKey].evaluation[segmentIndex] = newSegment;
    } else {
      newFeatureFlags[flagKey].evaluation.push(newSegment);
    }

    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {featureFlags: newFeatureFlags},
        }
      );

      ProjectStore.onUpdateSuccess(response);

      addSuccessMessage(
        defined(segmentIndex)
          ? t('Successfully edited segment')
          : t('Successfully added segment')
      );
      closeModal();
    } catch (err) {
      addErrorMessage(err);
    }

    setIsSaving(false);
  }

  function handleAddTag(selectedOptions: SelectValue<FeatureFlagSegmentTagKind>[]) {
    const previousCategories = data.tags.map(({category}) => category);
    const addedCategories = selectedOptions
      .filter(({value}) => {
        if (value === FeatureFlagSegmentTagKind.CUSTOM) {
          return true;
        }
        return !previousCategories.includes(value);
      })
      .map(({value}) => value);

    setData({
      ...data,
      tags: [
        ...data.tags,
        ...addedCategories.map(addedCategory => ({category: addedCategory, match: ''})),
      ],
    });
  }

  function handleDeleteTag(index: number) {
    const newTags = [...data.tags];
    newTags.splice(index, 1);
    setData({...data, tags: newTags});
  }

  function handleChangeTag<T extends keyof Tag>(index: number, field: T, value: Tag[T]) {
    const newTags = [...data.tags];
    newTags[index][field] = value;

    // If custom tag key changes, reset the value
    if (field === 'category') {
      newTags[index].match = '';
    }

    setData({...data, tags: newTags});
  }

  const segmentTypeChoices = flags[flagKey].evaluation.reduce(
    (acc, evaluation) => {
      if (!acc.some(value => value[0] === evaluation.type)) {
        acc.push([evaluation.type, startCase(evaluation.type)]);
      }
      return acc;
    },
    [
      [EvaluationType.Match, t('Match')],
      [EvaluationType.Rollout, t('Rollout')],
    ]
  );

  const predefinedTagsOptions = tagCategories.map(([value, label]) => {
    // Never disable the "Add Custom Tag" option, you can add more of those

    const optionDisabled =
      value === FeatureFlagSegmentTagKind.CUSTOM
        ? false
        : data.tags.some(condition => condition.category === value);
    return {
      value,
      label,
      disabled: optionDisabled,
      tooltip: optionDisabled ? t('This tag has already been added') : undefined,
    };
  });

  const submitDisabled =
    data.tags.some(condition => !condition.match) || !validResultValue(data.result);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{defined(segmentIndex) ? t('Edit Segment') : t('Add Segment')}</h4>
      </Header>
      <Body>
        <Fields>
          <StyledSelectField
            name="type"
            label={t('Type')}
            value={data.type}
            choices={segmentTypeChoices}
            onChange={value => setData({...data, type: value})}
            inline={false}
            hideControlState
            required
          />
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              {t('Conditions')}
              <StyledCompactSelect
                placement="bottom right"
                triggerProps={{
                  size: 'sm',
                  'aria-label': t('Add Tag'),
                }}
                triggerLabel={
                  <TriggerLabel>
                    <IconAdd isCircled />
                    {t('Add Tag')}
                  </TriggerLabel>
                }
                placeholder={t('Filter tags')}
                options={predefinedTagsOptions}
                value={data.tags
                  // We need to filter our custom tag option so that it can be selected multiple times without being unselected every other time
                  .filter(({category}) => category !== FeatureFlagSegmentTagKind.CUSTOM)
                  .map(({category}) => category)}
                onChange={handleAddTag}
                isSearchable
                multiple
                filterOption={(candidate, input) => {
                  // Always offer the "Add Custom Tag" option in the autocomplete
                  if (candidate.value === FeatureFlagSegmentTagKind.CUSTOM) {
                    return true;
                  }
                  return createFilter(null)(candidate, input);
                }}
                components={{
                  Option: containerProps => {
                    if (containerProps.value === FeatureFlagSegmentTagKind.CUSTOM) {
                      return (
                        <components.Option className="select-option" {...containerProps}>
                          <AddCustomTag isFocused={containerProps.isFocused}>
                            <IconAdd isCircled /> {t('Add Custom Tag')}
                          </AddCustomTag>
                        </components.Option>
                      );
                    }
                    return <Option {...containerProps} />;
                  },
                }}
              />
            </StyledPanelHeader>
            <PanelBody>
              {!data.tags.length ? (
                <EmptyMessage
                  icon={<IconSearch size="xl" />}
                  title={t('No tag conditions added')}
                  description={t(
                    'Click on the button above to add (+) a tag as condition'
                  )}
                />
              ) : (
                <Tags
                  tags={data.tags}
                  onDelete={handleDeleteTag}
                  onChange={handleChangeTag}
                  orgSlug={organization.slug}
                  projectSlug={project.slug}
                  projectId={project.id}
                />
              )}
            </PanelBody>
          </StyledPanel>
          {data.type === EvaluationType.Rollout && (
            <StyledField
              label={t('Rollout in percent')}
              help="This is the percentage of users that will match and the result will be returned."
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
            >
              <SliderWrapper>
                {'0%'}
                <StyledRangeSlider
                  name="rollout"
                  value={data.percentage ?? 0}
                  onChange={value => setData({...data, percentage: Number(value)})}
                  showLabel={false}
                />
                {'100%'}
              </SliderWrapper>
              <SliderPercentage>{`${data.percentage}%`}</SliderPercentage>
            </StyledField>
          )}
          {flags[flagKey].kind === FeatureFlagKind.BOOLEAN && (
            <StyledBooleanField
              label={`${t('Result value')} (boolean)`}
              name="result"
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: Boolean(value)})}
            />
          )}
          {flags[flagKey].kind === FeatureFlagKind.NUMBER && (
            <StyledNumberField
              label={`${t('Result value')} (number)`}
              placeholder="1"
              name="result"
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: Number(value)})}
              min={0}
            />
          )}
          {flags[flagKey].kind === FeatureFlagKind.STRING && (
            <StyledTextField
              label={`${t('Result value')} (string)`}
              placeholder="release"
              name="result"
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: String(value)})}
            />
          )}
          {flags[flagKey].kind === FeatureFlagKind.RATE && (
            <StyledField
              label={t('Resulting rate in percent')}
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
            >
              <SliderWrapper>
                {'0%'}
                <StyledRangeSlider
                  name="rollout"
                  value={typeof data.result === 'number' ? data.result : 0.0}
                  onChange={value => setData({...data, result: Number(value || 0)})}
                  showLabel={false}
                />
                {'100%'}
              </SliderWrapper>
              <SliderPercentage>{`${
                typeof data.result === 'number' ? data.result : 0.0
              }%`}</SliderPercentage>
            </StyledField>
          )}
        </Fields>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={handleSubmit}
            title={submitDisabled ? t('Required fields must be filled out') : undefined}
            disabled={isSaving || submitDisabled}
          >
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const AddCustomTag = styled('div')<{isFocused: boolean}>`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(0.75)};
  margin: 0 ${space(0.5)};
  gap: ${space(1)};
  line-height: 1.4;
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.isFocused && `background: ${p.theme.hover};`};
`;

const Fields = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const StyledCompactSelect = styled(CompactSelect)`
  font-weight: 400;
  text-transform: none;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-right: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const TriggerLabel = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
  border-bottom: none;
  width: 100%;
`;

const StyledField = styled(Field)`
  padding: 0;
  border-bottom: none;
`;

const SliderWrapper = styled('div')`
  width: 100%;
  display: grid;
  gap: ${space(1.5)};
  margin-top: ${space(0.5)};
  grid-template-columns: max-content max-content;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  padding-bottom: ${space(2)};

  @media (min-width: 700px) {
    grid-template-columns: max-content 1fr max-content;
    align-items: center;
    justify-content: flex-start;
    padding-bottom: 0;
  }
`;

const StyledRangeSlider = styled(RangeSlider)`
  ${Slider} {
    background: transparent;
    margin-top: 0;
    margin-bottom: 0;

    ::-ms-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }

    ::-moz-range-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }

    ::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px ${p => p.theme.backgroundSecondary};
    }
  }

  position: absolute;
  bottom: 0;
  left: ${space(1.5)};
  right: ${space(1.5)};

  @media (min-width: 700px) {
    position: static;
    left: auto;
    right: auto;
  }
`;

const SliderPercentage = styled('div')`
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledTextField = styled(TextField)`
  padding: 0;
  border-bottom: none;
`;

const StyledNumberField = styled(NumberField)`
  padding: 0;
  border-bottom: none;
`;

const StyledBooleanField = styled(BooleanField)`
  padding: 0;
  border-bottom: none;
  ${FieldDescription} {
    width: auto;
  }
`;
