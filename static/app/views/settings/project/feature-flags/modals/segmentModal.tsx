import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Slider from 'sentry/components/forms/controls/rangeSlider/slider';
import Field from 'sentry/components/forms/field';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconAdd, IconDelete, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {FeatureFlags} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import {percentageToRate} from '../../server-side-sampling/utils';

import {AutoCompleteField, StyledSelectField} from './autoCompleteField';
import {FooterActions} from './flagModal';

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
  flags,
  flagKey,
  organization,
  project,
  segmentIndex,
}: Props) {
  const api = useApi();

  const segment = defined(segmentIndex)
    ? flags[flagKey].evaluations[segmentIndex]
    : undefined;

  const [type, setType] = useState(segment?.type ?? 'rollout');
  const [tags, setTags] = useState(
    segment?.tags
      ? Object.keys(segment.tags).reduce((acc, tagKey) => {
          if (acc.some(value => Object.keys(value)[0] === tagKey)) {
            return acc;
          }

          acc.push({[tagKey]: segment?.tags?.[tagKey] ?? ''});

          return acc;
        }, [] as Record<string, string>[])
      : []
  );

  const [percentage, setPercentage] = useState(
    segment?.type === 'rollout' ? segment.percentage ?? 0 : 0
  );

  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit() {
    setIsSaving(true);

    const newEvaluations = [...flags[flagKey].evaluations];

    const newTags = tags.reduce((acc, tag) => {
      const tagKey = Object.keys(tag)[0];
      const tagValue = Object.values(tag)[0];
      acc[tagKey] = tagValue;
      return acc;
    }, {});

    if (defined(segmentIndex)) {
      if (type === 'rollout') {
        newEvaluations[segmentIndex] = {
          result: newEvaluations[segmentIndex].result,
          type,
          percentage: percentageToRate(percentage),
          tags: newTags,
        };
      } else {
        newEvaluations[segmentIndex] = {
          result: newEvaluations[segmentIndex].result,
          type,
          tags: newTags,
        };
      }
    } else {
      if (type === 'rollout') {
        newEvaluations.push({
          type,
          percentage: percentageToRate(percentage),
          tags: newTags,
          result: true,
        });
      } else {
        newEvaluations.push({
          type,
          tags: newTags,
          result: true,
        });
      }
    }

    const newFeatureFlags = {
      ...flags,
      [flagKey]: {
        ...flags[flagKey],
        evaluations: newEvaluations,
      },
    };

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
        segment ? t('Successfully edited segment') : t('Successfully added segment')
      );
      closeModal();
    } catch (err) {
      addErrorMessage(err);
    }

    setIsSaving(false);
  }

  const submitDisabled =
    tags.length > 0 && tags.some(tag => !Object.keys(tag)[0] || !Object.values(tag)[0]);

  const segmentTypeChoices = flags[flagKey].evaluations.reduce(
    (acc, evaluation) => {
      if (!acc.some(value => value[0] === evaluation.type)) {
        acc.push([evaluation.type, startCase(evaluation.type)]);
      }
      return acc;
    },
    [
      ['rollout', t('Rollout')],
      ['match', t('Match')],
    ]
  );

  const tagKeyOptions = flags[flagKey].evaluations.reduce((acc, evaluation) => {
    Object.keys(evaluation.tags ?? {}).forEach(key => {
      if (!acc.some(value => value.value === key)) {
        acc.push({value: key, label: key});
      }
    });
    return acc;
  }, [] as {label: string; value: string}[]);

  function handleAddTag() {
    setTags([...tags, {}]);
  }

  function handleDeleteTag(index: number) {
    const newTags = [...tags];
    newTags.splice(index, 1);
    setTags(newTags);
  }

  function handleChangeTag<T extends 'key' | 'value'>(
    index: number,
    field: T,
    value?: string
  ) {
    const newTags = [...tags].map((tag, i) => {
      if (i === index) {
        if (field === 'key') {
          return {[value ?? '']: Object.values(tag)[0]};
        }
        return {[Object.keys(tag)[0]]: value ?? ''};
      }
      return tag;
    });

    setTags(newTags);
  }

  const tagValueOptions = tags.reduce((acc, tag) => {
    const tagValue = Object.values(tag)[0];
    if (!acc.some(value => value.value === tagValue)) {
      acc.push({value: tagValue, label: tagValue});
    }
    return acc;
  }, [] as {label: string; value: string}[]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{segment ? t('Edit Segment') : t('Add Segment')}</h4>
      </Header>
      <Body>
        <Fields>
          <StyledSelectField
            name="type"
            label={t('Type')}
            value={type}
            choices={segmentTypeChoices}
            onChange={setType}
            inline={false}
            hideControlState
            required
          />
          <StyledPanel>
            <StyledPanelHeader hasButtons>
              {t('Tags')}
              <Button
                aria-label={t('Add Tag')}
                size="sm"
                onClick={handleAddTag}
                icon={<IconAdd isCircled />}
              >
                {t('Add Tag')}
              </Button>
            </StyledPanelHeader>
            <PanelBody>
              {!tags.length ? (
                <EmptyMessage
                  icon={<IconSearch size="xl" />}
                  title={t('No tags added')}
                  description={t('Click on the button above to add (+) a tag')}
                />
              ) : (
                tags.map((tag, index) => {
                  return (
                    <TagFields key={index}>
                      <LeftCell>
                        <AutoCompleteField
                          name="tag-key"
                          value={Object.keys(tag)[0]}
                          options={tagKeyOptions}
                          onChange={v => handleChangeTag(index, 'key', v)}
                          placeholder={t('ex. isEarlyAdopter')}
                        />
                      </LeftCell>
                      <CenterCell>
                        <AutoCompleteField
                          name="tag-value"
                          options={tagValueOptions}
                          value={Object.values(tag)[0]}
                          onChange={v => handleChangeTag(index, 'value', v)}
                          placeholder={t('ex. true')}
                        />
                      </CenterCell>
                      <RightCell>
                        <Button
                          onClick={() => handleDeleteTag(index)}
                          icon={<IconDelete />}
                          aria-label={t('Delete Condition')}
                        />
                      </RightCell>
                    </TagFields>
                  );
                })
              )}
            </PanelBody>
          </StyledPanel>
          {type === 'rollout' && (
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
                  value={percentage ?? 0}
                  onChange={value => setPercentage(Number(value))}
                  showLabel={false}
                />
                {'100%'}
              </SliderWrapper>
              <SliderPercentage>{`${percentage}%`}</SliderPercentage>
            </StyledField>
          )}
        </Fields>
      </Body>
      <Footer>
        <FooterActions>
          <Button href="" external>
            {t('Read Docs')}
          </Button>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="primary"
              onClick={handleSubmit}
              title={submitDisabled ? t('Required fields must be filled out') : undefined}
              disabled={submitDisabled || isSaving}
            >
              {t('Save')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const StyledField = styled(Field)`
  padding: 0;
`;

const Fields = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-right: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
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

const TagFields = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: flex-start;
  padding: ${space(1)} ${space(2)};
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.gray100};
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr max-content;
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

const SliderPercentage = styled('div')`
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
`;
