import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import {EventGroupVariant, EventGroupVariantType, EventGroupComponent} from 'app/types';

import {hasNonContributingComponent} from './utils';
import GroupingComponent from './groupingComponent';

type Props = {
  variant: EventGroupVariant;
};

type State = {
  showNonContributing: boolean;
};

class GroupVariant extends React.Component<Props, State> {
  state = {
    showNonContributing: false,
  };

  toggleNonContributing = () => {
    this.setState({
      showNonContributing: !this.state.showNonContributing,
    });
  };

  getVariantData() {
    const {variant} = this.props;
    const data = [[t('Type'), variant.type]];
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
          data.push(['Fingerprint values', variant.values]);
        }
        if (variant.config?.id) {
          data.push(['Grouping Config', variant.config.id]);
        }
        break;
      default:
        break;
    }

    return [data, component];
  }

  render() {
    const {variant} = this.props;
    const [data, component] = this.getVariantData();

    return (
      <GroupVariantListItem isContributing={variant.hash !== null}>
        <GroupVariantTitle>{`${t('by')} ${variant.description}`}</GroupVariantTitle>

        <KeyValueList data={data} isContextData />
        {component && (
          <GroupingComponentBox>
            {/* TODO(grouping): use button bar */}
            {hasNonContributingComponent(component) && (
              <a className="pull-right" onClick={this.toggleNonContributing}>
                {this.state.showNonContributing
                  ? t('hide non contributing values')
                  : t('show non contributing values')}
              </a>
            )}
            <GroupingComponent
              component={component}
              showNonContributing={this.state.showNonContributing}
            />
          </GroupingComponentBox>
        )}
      </GroupVariantListItem>
    );
  }
}

const GroupVariantListItem = styled('li')<{isContributing: boolean}>`
  padding: 15px 0 20px 0;
  color: ${p => (p.isContributing ? null : p.theme.gray6)};

  & + li {
    margin-top: 15px;
  }
`;

const GroupVariantTitle = styled('h5')`
  margin: 0 0 10px 0;
  color: inherit !important;
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const GroupingComponentBox = styled('div')`
  padding: 10px 0 0 0;
  margin-top: -10px;
`;

export default GroupVariant;
