import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import flatten from 'lodash/flatten';
import startCase from 'lodash/startCase';

import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownLink from 'sentry/components/dropdownLink';
import FeatureBadge from 'sentry/components/featureBadge';
import BooleanField from 'sentry/components/forms/booleanField';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import Slider from 'sentry/components/forms/controls/rangeSlider/slider';
import Field from 'sentry/components/forms/field';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Tag from 'sentry/components/tag';
import {IconDownload, IconEllipsis} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {rateToPercentage} from '../server-side-sampling/utils';

import flags from './flags.json';

type Props = {
  project: Project;
};

type Tags = Record<string, string | boolean>;

type Evaluation = {
  result: boolean;
  tags: Record<string, string>;
  type: 'rollout' | 'match';
  percentage?: number;
};

type FeatureFlag = Record<
  string,
  {
    evaluation: Evaluation[];
    expanded: boolean;
    tags: Tags;
  }
>;

export default function FeatureFlags({project}: Props) {
  console.log({project});
  const [state, setState] = useState<FeatureFlag>(
    Object.keys(flags).reduce((acc, flag) => {
      acc[flag] = {
        ...flags[flag],
        expanded: false,
      };
      return acc;
    }, {})
  );

  function handleDelete() {}

  function handleEdit() {}

  return (
    <SentryDocumentTitle title={t('Feature Flags')}>
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              {t('Feature Flags')} <FeatureBadge type="beta" />
            </Fragment>
          }
        />
        <TextBlock>
          {tct(
            'Feature flags allow you to configure your code into different flavors by dynamically toggling certain functionality on and off. Learn more about feature flags in our [link:documentation].',
            {
              link: <ExternalLink href="" />,
            }
          )}
        </TextBlock>
        <FlagsPanel>
          <FlagsPanelHeader>
            <FlagsPanelLayout>
              <Column>{t('Name')}</Column>
              <TagsColumn>{t('Tags')}</TagsColumn>
              <RolloutColumn>{t('Rollout')}</RolloutColumn>
              <DefaultColumn>{t('Status')}</DefaultColumn>
              <Column />
            </FlagsPanelLayout>
          </FlagsPanelHeader>
          <PanelBody>
            {Object.keys(state).map(flag => {
              const active = state[flag].evaluation.some(e => e.result);
              const tags = flatten(
                state[flag].evaluation
                  .map(evaluation => {
                    if (evaluation.tags) {
                      return Object.keys(evaluation.tags ?? {}).map(tagKey => (
                        <Pill
                          key={tagKey}
                          name={tagKey}
                          value={evaluation.tags[tagKey]}
                        />
                      ));
                    }
                    return null;
                  })
                  .filter(defined)
              );
              return (
                <FlagsPanelLayout key={flag} isContent>
                  <Column>{startCase(flag)}</Column>
                  <TagsColumn>{!!tags.length && <Pills>{tags}</Pills>}</TagsColumn>
                  <RolloutColumn>
                    {rateToPercentage(state[flag].evaluation[0].percentage) ?? 0}
                    {'%'}
                  </RolloutColumn>
                  <DefaultColumn>
                    <ActiveToggle
                      inline={false}
                      hideControlState
                      name={flag}
                      value={active}
                    />
                  </DefaultColumn>
                  <Column>
                    <EllipisDropDownButton
                      caret={false}
                      customTitle={
                        <Button
                          aria-label={t('Actions')}
                          icon={<IconEllipsis />}
                          size="sm"
                        />
                      }
                      anchorRight
                    >
                      <MenuItemActionLink
                        shouldConfirm={false}
                        icon={<IconDownload size="xs" />}
                        title={t('Edit')}
                        onClick={handleEdit}
                      >
                        {t('Edit')}
                      </MenuItemActionLink>
                      <MenuItemActionLink
                        onAction={handleDelete}
                        message={t('Are you sure you wish to delete this feature flag?')}
                        icon={<IconDownload size="xs" />}
                        title={t('Delete')}
                        priority="danger"
                        shouldConfirm
                      >
                        {t('Delete')}
                      </MenuItemActionLink>
                    </EllipisDropDownButton>
                  </Column>
                </FlagsPanelLayout>
              );
            })}
          </PanelBody>
          <FlagsPanelFooter>
            <ButtonBar gap={1}>
              <Button href="" external>
                {t('Read Docs')}
              </Button>
              <Button onClick={() => {}} priority="primary">
                {t('Add Flag')}
              </Button>
            </ButtonBar>
          </FlagsPanelFooter>
        </FlagsPanel>
      </Fragment>
    </SentryDocumentTitle>
  );
}

const FlagsPanel = styled(Panel)``;

const FlagsPanelHeader = styled(PanelHeader)`
  padding: ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const FlagsPanelFooter = styled(PanelFooter)`
  padding: ${space(1.5)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const FlagsPanelLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 0.5fr 74px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1.5fr 1fr 0.5fr 85px 74px;
  }

  ${p =>
    p.isContent &&
    css`
      > * {
        /* match the height of the ellipsis button */
        line-height: 34px;
      }

      :not(:last-child) {
        border-bottom: 1px solid ${p.theme.border};
      }
    `}
`;

const Column = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

const RolloutColumn = styled(Column)`
  justify-content: flex-end;
  text-align: right;
`;

const TagsColumn = styled(Column)`
  text-align: left;
`;

const DefaultColumn = styled(Column)`
  justify-content: center;
  text-align: center;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

const EllipisDropDownButton = styled(DropdownLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

const ActiveToggle = styled(BooleanField)`
  padding: 0;
  height: 34px;
  justify-content: center;
`;

const ExpandIcon = styled(IconChevron)`
  cursor: pointer;
`;

const ExpandedContent = styled(Column)`
  grid-column: 2/-1;
`;

const SliderWrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
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

const RolloutField = styled(Field)`
  padding: 0;
  width: 100%;
`;
