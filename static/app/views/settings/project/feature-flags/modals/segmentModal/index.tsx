import {Fragment, useState} from 'react';
import {createFilter} from 'react-select';
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
} from 'sentry/types/featureFlags';
import {SamplingInnerName} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import {percentageToRate, rateToPercentage} from '../../../server-side-sampling/utils';

import {Condition, Tags} from './tags';
import {
  distributedTracesConditions,
  generateConditionCategoriesOptions,
  validResultValue,
} from './utils';

const conditionAlreadyAddedTooltip = t('This tag has already been added');

type State = {
  conditions: Condition[];
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

  const conditionCategories = generateConditionCategoriesOptions(
    distributedTracesConditions
  );

  function getInitialState(): State {
    if (defined(segmentIndex)) {
      const segment = flags[flagKey].evaluation[segmentIndex];

      return {
        type: segment.type,
        conditions: Object.entries(segment.tags ?? {}).map(([key, value]) => ({
          category:
            key === 'environment'
              ? SamplingInnerName.TRACE_ENVIRONMENT
              : key === 'release'
              ? SamplingInnerName.TRACE_RELEASE
              : (key as SamplingInnerName),
          match: value,
        })),
        result: segment.result,
        percentage: defined(segment.percentage)
          ? rateToPercentage(segment.percentage)
          : undefined,
      };
    }

    return {
      type: EvaluationType.Rollout,
      conditions: [],
      percentage: 0,
      result: undefined,
    };
  }

  async function handleSubmit() {
    if (!defined(data.result)) {
      return;
    }

    setIsSaving(true);

    const newTags = data.conditions.reduce((acc, condition) => {
      if (acc[condition.category] || !condition.match) {
        return acc;
      }

      if (condition.category === SamplingInnerName.TRACE_ENVIRONMENT) {
        acc.environment = condition.match;
        return acc;
      }

      if (condition.category === SamplingInnerName.TRACE_RELEASE) {
        acc.release = condition.match;
        return acc;
      }

      return acc;
    }, {} as Record<string, string>);

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
      result: data.result,
      id: flags[flagKey].evaluation.length,
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

  function handleAddCondition(selectedOptions: SelectValue<SamplingInnerName>[]) {
    const previousCategories = data.conditions.map(({category}) => category);
    const addedCategories = selectedOptions
      .filter(({value}) => !previousCategories.includes(value))
      .map(({value}) => value);

    setData({
      ...data,
      conditions: [
        ...data.conditions,
        ...addedCategories.map(addedCategory => ({category: addedCategory, match: ''})),
      ],
    });
  }

  function handleDeleteCondition(index: number) {
    const newConditions = [...data.conditions];
    newConditions.splice(index, 1);
    setData({...data, conditions: newConditions});
  }

  function handleChangeCondition<T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) {
    const newConditions = [...data.conditions];
    newConditions[index][field] = value;

    // If custom tag key changes, reset the value
    if (field === 'category') {
      newConditions[index].match = '';
    }

    setData({...data, conditions: newConditions});
  }

  const segmentTypeChoices = flags[flagKey].evaluation.reduce(
    (acc, evaluation) => {
      if (!acc.some(value => value[0] === evaluation.type)) {
        acc.push([evaluation.type, startCase(evaluation.type)]);
      }
      return acc;
    },
    [
      [EvaluationType.Rollout, t('Rollout')],
      [EvaluationType.Match, t('Match')],
    ]
  );

  const predefinedConditionsOptions = conditionCategories.map(([value, label]) => {
    const optionDisabled = data.conditions.some(
      condition => condition.category === value
    );
    return {
      value,
      label,
      disabled: optionDisabled,
      tooltip: optionDisabled ? conditionAlreadyAddedTooltip : undefined,
    };
  });

  const submitDisabled =
    data.conditions.some(condition => !condition.match) || !validResultValue(data.result);

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
              {t('Tags')}
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
                options={predefinedConditionsOptions}
                value={data.conditions.map(({category}) => category)}
                onChange={handleAddCondition}
                isSearchable
                multiple
                filterOption={(candidate, input) => createFilter(null)(candidate, input)}
                components={{
                  Option: containerProps => <Option {...containerProps} />,
                }}
              />
            </StyledPanelHeader>
            <PanelBody>
              {!data.conditions.length ? (
                <EmptyMessage
                  icon={<IconSearch size="xl" />}
                  title={t('No tags added')}
                  description={t('Click on the button above to add (+) a tag')}
                />
              ) : (
                <Tags
                  conditions={data.conditions}
                  onDelete={handleDeleteCondition}
                  onChange={handleChangeCondition}
                  orgSlug={organization.slug}
                  projectId={project.id}
                />
              )}
            </PanelBody>
          </StyledPanel>
          {data.type === EvaluationType.Rollout && (
            <StyledField
              label={`${t('Rollout')} \u0025`}
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
              label={t('Result Value')}
              name="result"
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: Boolean(value)})}
            />
          )}
          {flags[flagKey].kind === FeatureFlagKind.NUMBER && (
            <StyledNumberField
              label={t('Result Value')}
              name="result"
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: Number(value)})}
            />
          )}
          {flags[flagKey].kind === FeatureFlagKind.STRING && (
            <StyledTextField
              label={t('Result Value')}
              name="result"
              inline={false}
              flexibleControlStateSize
              hideControlState
              required
              value={data.result}
              onChange={value => setData({...data, result: String(value)})}
            />
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
`;
