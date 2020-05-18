import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import {EventGroupVariant, EventGroupVariantType, EventGroupComponent} from 'app/types';
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import theme from 'app/utils/theme';
import {IconCheckmark, IconClose} from 'app/icons';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';

import {hasNonContributingComponent} from './utils';
import GroupingComponent from './groupingComponent';

type Props = {
  variant: EventGroupVariant;
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
    const {variant} = this.props;
    const data: VariantData = [[t('Type'), variant.type]];
    let component: EventGroupComponent | undefined;

    if (variant.hash !== null) {
      data.push([t('Hash'), variant.hash]);
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
        if (variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
        break;
      case EventGroupVariantType.CUSTOM_FINGERPRINT:
        if (variant.values) {
          data.push([t('Fingerprint values'), variant.values]);
        }
        break;
      case EventGroupVariantType.SALTED_COMPONENT:
        component = variant.component;
        if (variant.values) {
          data.push([t('Fingerprint values'), variant.values]);
        }
        if (variant.config?.id) {
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

    return (
      <Tooltip
        title={isContributing ? t('Contributing variant') : t('Non-contributing variant')}
      >
        <GroupVariantTitle>
          <ContributionIcon isContributing={isContributing} />
          {t('By')}{' '}
          {variant.description
            .split(' ')
            .map(i => capitalize(i))
            .join(' ')}
        </GroupVariantTitle>
      </Tooltip>
    );
  }

  renderContributionToggle() {
    const {showNonContributing} = this.state;

    return (
      <ButtonBar merged active={showNonContributing ? 'all' : 'relevant'}>
        <Button barId="relevant" size="xsmall" onClick={this.handleHideNonContributing}>
          {t('Contributing values')}
        </Button>
        <Button barId="all" size="xsmall" onClick={this.handleShowNonContributing}>
          {t('All values')}
        </Button>
      </ButtonBar>
    );
  }

  render() {
    const [data, component] = this.getVariantData();

    return (
      <GroupVariantListItem>
        <Header>
          {this.renderTitle()}
          {hasNonContributingComponent(component) && this.renderContributionToggle()}
        </Header>

        <KeyValueList data={data} isContextData isSorted={false} />
      </GroupVariantListItem>
    );
  }
}

const GroupVariantListItem = styled('li')`
  margin-bottom: ${space(4)};
  & + li {
    padding-top: ${space(4)};
    border-top: 1px solid ${p => p.theme.borderLight};
  }
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const GroupVariantTitle = styled('h5')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const ContributionIcon = styled(({isContributing, ...p}) =>
  isContributing ? (
    <IconCheckmark size="sm" isCircled color={theme.green} {...p} />
  ) : (
    <IconClose size="sm" isCircled color={theme.red} {...p} />
  )
)`
  margin-right: ${space(1)};
  transform: translateY(3px);
`;

const GroupingTree = styled('div')`
  color: #2f2936;
`;

export default GroupVariant;
