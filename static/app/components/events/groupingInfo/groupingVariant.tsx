import {Component} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  EventGroupComponent,
  EventGroupVariant,
  EventGroupVariantType,
} from 'sentry/types';

import GroupingComponent from './groupingComponent';
import {hasNonContributingComponent} from './utils';

type Props = {
  showGroupingConfig: boolean;
  variant: EventGroupVariant;
};

type State = {
  showNonContributing: boolean;
};

type VariantData = [string, React.ReactNode][];

function addFingerprintInfo(data: VariantData, variant: EventGroupVariant) {
  if ('matched_rule' in variant) {
    data.push([
      t('Fingerprint rule'),
      <TextWithQuestionTooltip key="type">
        {variant.matched_rule}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t('The server-side fingerprinting rule that produced the fingerprint.')}
        />
      </TextWithQuestionTooltip>,
    ]);
  }
  if ('values' in variant) {
    data.push([t('Fingerprint values'), variant.values]);
  }
  if ('client_values' in variant) {
    data.push([
      t('Client fingerprint values'),
      <TextWithQuestionTooltip key="type">
        {variant.client_values}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t(
            'The client sent a fingerprint that was overridden by a server-side fingerprinting rule.'
          )}
        />
      </TextWithQuestionTooltip>,
    ]);
  }
}

class GroupVariant extends Component<Props, State> {
  state: State = {
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
        addFingerprintInfo(data, variant);
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
        addFingerprintInfo(data, variant);
        if (showGroupingConfig && variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
        break;
      case EventGroupVariantType.PERFORMANCE_PROBLEM:
        data.push([
          t('Type'),
          <TextWithQuestionTooltip key="type">
            {variant.type}
            <QuestionTooltip
              size="xs"
              position="top"
              title={t(
                'Uses the evidence from performance issue detection to generate a fingerprint.'
              )}
            />
          </TextWithQuestionTooltip>,
        ]);

        data.push(['Performance Issue Type', variant.key]);
        data.push(['Span Operation', variant.evidence.op]);
        data.push(['Parent Span Hashes', variant.evidence.parent_span_hashes]);
        data.push(['Source Span Hashes', variant.evidence.cause_span_hashes]);
        data.push([
          'Offender Span Hashes',
          [...new Set(variant.evidence.offender_span_hashes)],
        ]);
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

    let title: string;
    if (isContributing) {
      title = t('Contributing variant');
    } else {
      const hint = 'component' in variant ? variant.component?.hint : undefined;
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
        <Button barId="relevant" size="xs" onClick={this.handleHideNonContributing}>
          {t('Contributing values')}
        </Button>
        <Button barId="all" size="xs" onClick={this.handleShowNonContributing}>
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

        <KeyValueList
          data={data.map(d => ({
            key: d[0],
            subject: d[0],
            value: d[1],
          }))}
          isContextData
          isSorted={false}
        />
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
  @media (max-width: ${p => p.theme.breakpoints.small}) {
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
    <IconCheckmark size="sm" isCircled color="successText" {...p} />
  ) : (
    <IconClose size="sm" isCircled color="dangerText" {...p} />
  )
)`
  margin-right: ${space(1)};
`;

const ContributingToggle = styled(ButtonBar)`
  justify-content: flex-end;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(0.5)};
  }
`;

const GroupingTree = styled('div')`
  color: ${p => p.theme.textColor};
`;

const TextWithQuestionTooltip = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: auto 1fr;
  gap: ${space(0.5)};
`;

const Hash = styled('span')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    ${p => p.theme.overflowEllipsis};
    width: 210px;
  }
`;

export default GroupVariant;
