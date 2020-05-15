import React from 'react';
import PropTypes from 'prop-types';
import isObject from 'lodash/isObject';
import styled from '@emotion/styled';

class GroupingComponent extends React.Component {
  static propTypes = {
    component: PropTypes.object,
    showNonContributing: PropTypes.bool,
  };

  render() {
    const {component} = this.props;

    const children = component.values.map((value, idx) => {
      let rv;
      if (isObject(value)) {
        // no point rendering such nodes at all, we never show them
        if (!value.contributes && !value.hint && value.values.length === 0) {
          return null;
        }
        // non contributing values are otherwise optional
        if (!this.props.showNonContributing && !value.contributes) {
          return null;
        }
        rv = (
          <GroupingComponent
            component={value}
            showNonContributing={this.props.showNonContributing}
          />
        );
      } else {
        rv = <GroupingValue>{JSON.stringify(value, null, 2)}</GroupingValue>;
      }
      return <GroupingComponentListItem key={idx}>{rv}</GroupingComponentListItem>;
    });

    return (
      <GroupingComponentWrapper contributes={component.contributes}>
        <span>
          {component.name || component.id}
          {component.hint && <small>{` (${component.hint})`}</small>}
        </span>
        <GroupingComponentList>{children}</GroupingComponentList>
      </GroupingComponentWrapper>
    );
  }
}

const GroupingComponentList = styled('ul')`
  padding: 0;
  margin: 0;
  list-style: none;
`;

const GroupingComponentListItem = styled('li')`
  padding: 0;
  margin: 2px 0 1px 13px;
`;

const GroupingComponentWrapper = styled(({contributes: _contributes, ...props}) => (
  <div {...props} />
))`
  ${p => (p.contributes ? '' : 'color:' + p.theme.gray6)};
`;

const GroupingValue = styled('code')`
  display: inline-block;
  margin: 1px 4px 1px 0;
  font-size: 12px;
  padding: 1px 2px;
  color: inherit;
`;

export default GroupingComponent;
