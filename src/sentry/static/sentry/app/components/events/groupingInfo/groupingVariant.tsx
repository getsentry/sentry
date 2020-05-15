import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';

import {hasNonContributingComponent} from './utils';
import GroupingComponent from './groupingComponent';

class GroupVariant extends React.Component {
  static propTypes = {
    variant: PropTypes.object,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      showNonContributing: false,
    };
  }

  toggleNonContributing = () => {
    this.setState({
      showNonContributing: !this.state.showNonContributing,
    });
  };

  renderVariantDetails() {
    const {variant} = this.props;
    const data = [['Type', variant.type]];
    let component = null;

    if (variant.hash !== null) {
      data.push(['Hash', variant.hash]);
    }
    if (variant.hashMismatch) {
      data.push([
        'Hash mismatch',
        'hashing algorithm produced a hash that does not match the event',
      ]);
    }

    switch (variant.type) {
      case 'component':
        component = variant.component;
        data.push(['Grouping Config', variant.config.id]);
        break;
      case 'custom-fingerprint':
        data.push(['Fingerprint values', variant.values]);
        break;
      case 'salted-component':
        data.push(['Fingerprint values', variant.values]);
        data.push(['Grouping Config', variant.config.id]);
        component = variant.component;
        break;
      default:
        break;
    }

    return (
      <div>
        <KeyValueList data={data} isContextData />
        {component && (
          <GroupingComponentBox>
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
      </div>
    );
  }

  render() {
    const {variant} = this.props;
    return (
      <GroupVariantListItem contributes={variant.hash !== null}>
        <GroupVariantTitle>{`by ${variant.description}`}</GroupVariantTitle>
        {this.renderVariantDetails()}
      </GroupVariantListItem>
    );
  }
}

const GroupVariantListItem = styled(({contributes: _contributes, ...props}) => (
  <li {...props} />
))`
  padding: 15px 0 20px 0;
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};

  & + li {
    margin-top: 15px;
  }
`;

const GroupVariantTitle = styled('h5')`
  margin: 0 0 10px 0;
  color: inherit !important;
  text-transform: uppercase;
  font-size: 14px;
`;

const GroupingComponentBox = styled('div')`
  padding: 10px 0 0 0;
  margin-top: -10px;
`;

export default GroupVariant;
