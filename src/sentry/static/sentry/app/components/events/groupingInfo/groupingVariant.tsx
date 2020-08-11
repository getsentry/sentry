import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import {EventGroupVariant, EventGroupVariantType, EventGroupComponent} from 'app/types';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import {IconCheckmark, IconClose} from 'app/icons';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import QuestionTooltip from 'app/components/questionTooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {hasNonContributingComponent} from './utils';
import GroupingComponent from './groupingComponent';

type Props = {
  variant: EventGroupVariant;
  showGroupingConfig: boolean;
};

type State = {
  showNonContributing: boolean;
};

type VariantData = [string, React.ReactNode][];

class GroupVariant extends React.Component<Props, State> {
  state = {
    showNonContributing: false,
  };

  handleShowNonContributing = () => {
    this.setState({showNonContributing: true});
  };

  handleHideNonContributing = () => {
    this.setState({showNonContributing: false});
  };

  getVariantData(): [VariantData, EventGroupComponent | undefined] {
    const {variant, showGroupingConfig} = this.props;
    const data: VariantData = [];
    let component: EventGroupComponent | undefined;

    if (!this.state.showNonContributing && variant.hash === null) {
      return [data, component];
    }

    if (variant.hash !== null) {
      data.push([
        t('Hash'),
        <TextWithQuestionTooltip key="hash">
          <Hash>{variant.hash}</Hash>
          <QuestionTooltip
            size="xs"
            position="top"
            title={t('Events with the same hash are grouped together')}
          />
        </TextWithQuestionTooltip>,
      ]);
    }

    if (variant.hashMismatch) {
      data.push([
        t('Hash mismatch'),
        t('hashing algorithm produced a hash that does not match the event'),
      ]);
    }

    switch (variant.type) {
      case EventGroupVariantType.COMPONENT:
        component = variant.component;
        data.push([
          t('Type'),
          <TextWithQuestionTooltip key="type">
            {variant.type}
            <QuestionTooltip
              size="xs"
              position="top"
              title={t(
                'Uses a complex grouping algorithm taking event data into account'
              )}
            />
          </TextWithQuestionTooltip>,
        ]);
        if (showGroupingConfig && variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
        break;
      case EventGroupVariantType.CUSTOM_FINGERPRINT:
        data.push([
          t('Type'),
          <TextWithQuestionTooltip key="type">
            {variant.type}
            <QuestionTooltip
              size="xs"
              position="top"
              title={t('Overrides the default grouping by a custom fingerprinting rule')}
            />
          </TextWithQuestionTooltip>,
        ]);
        if (variant.values) {
          data.push([t('Fingerprint values'), variant.values]);
        }
        break;
      case EventGroupVariantType.SALTED_COMPONENT:
        component = variant.component;
        data.push([
          t('Type'),
          <TextWithQuestionTooltip key="type">
            {variant.type}
            <QuestionTooltip
              size="xs"
              position="top"
              title={t(
                'Uses a complex grouping algorithm taking event data and a fingerprint into account'
              )}
            />
          </TextWithQuestionTooltip>,
        ]);
        if (variant.values) {
          data.push([t('Fingerprint values'), variant.values]);
        }
        if (showGroupingConfig && variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
        break;
      default:
        break;
    }

    if (component) {
      data.push([
        t('Grouping'),
        <GroupingTree key={component.id}>
          <GroupingComponent
            component={component}
            showNonContributing={this.state.showNonContributing}
          />
        </GroupingTree>,
      ]);
    }

    return [data, component];
  }

  renderTitle() {
    const {variant} = this.props;
    const isContributing = variant.hash !== null;

    let title;
    if (isContributing) {
      title = t('Contributing variant');
    } else {
      const hint = variant.component?.hint;
      if (hint) {
        title = t('Non-contributing variant: %s', hint);
      } else {
        title = t('Non-contributing variant');
      }
    }

    return (
      <Tooltip title={title}>
        <VariantTitle>
          <ContributionIcon isContributing={isContributing} />
          {t('By')}{' '}
          {variant.description
            ?.split(' ')
            .map(i => capitalize(i))
            .join(' ') ?? t('Nothing')}
        </VariantTitle>
      </Tooltip>
    );
  }

  renderContributionToggle() {
    const {showNonContributing} = this.state;

    return (
      <ContributingToggle merged active={showNonContributing ? 'all' : 'relevant'}>
        <Button barId="relevant" size="xsmall" onClick={this.handleHideNonContributing}>
          {t('Contributing values')}
        </Button>
        <Button barId="all" size="xsmall" onClick={this.handleShowNonContributing}>
          {t('All values')}
        </Button>
      </ContributingToggle>
    );
  }

  render() {
    const [data, component] = this.getVariantData();

    return (
      <VariantWrapper>
        <Header>
          {this.renderTitle()}
          {hasNonContributingComponent(component) && this.renderContributionToggle()}
        </Header>

        <KeyValueList data={data} isContextData isSorted={false} />
      </VariantWrapper>
    );
  }
}

const VariantWrapper = styled('div')`
  margin-bottom: ${space(4)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const VariantTitle = styled('h5')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  display: flex;
  align-items: center;
`;

const ContributionIcon = styled(({isContributing, ...p}) =>
  isContributing ? (
    <IconCheckmark size="sm" isCircled color="green400" {...p} />
  ) : (
    <IconClose size="sm" isCircled color="red" {...p} />
  )
)`
  margin-right: ${space(1)};
`;

const ContributingToggle = styled(ButtonBar)`
  justify-content: flex-end;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(0.5)};
  }
`;

const GroupingTree = styled('div')`
  color: #2f2936;
`;

const TextWithQuestionTooltip = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: max-content min-content;
  grid-gap: ${space(0.5)};
`;

const Hash = styled('span')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    ${overflowEllipsis};
    width: 210px;
  }
`;

export default GroupVariant;
