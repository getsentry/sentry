import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {tct} from 'app/locale';
import Button from 'app/components/button';
import {IconAdd, IconSubtract} from 'app/icons';

import {GroupingComponentListItem} from './groupingComponent';

type DefaultProps = {
  maxVisibleItems: number;
};

type Props = DefaultProps & {
  items: React.ReactNode[];
};

type State = {
  collapsed: boolean;
};

class GroupingComponentFrames extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxVisibleItems: 2,
  };

  state: State = {
    collapsed: true,
  };

  render() {
    const {items, maxVisibleItems} = this.props;
    const {collapsed} = this.state;
    const isCollapsable = items.length > maxVisibleItems;

    return (
      <React.Fragment>
        {items.map((item, index) => {
          if (!collapsed || index < maxVisibleItems) {
            return (
              <GroupingComponentListItem isCollapsable={isCollapsable} key={index}>
                {item}
              </GroupingComponentListItem>
            );
          }

          if (index === maxVisibleItems) {
            return (
              <GroupingComponentListItem key={index}>
                <ToggleCollapse
                  size="small"
                  priority="link"
                  icon={<IconAdd size="8px" />}
                  onClick={() => this.setState({collapsed: false})}
                >
                  {tct('show [numberOfFrames] similiar', {
                    numberOfFrames: items.length - maxVisibleItems,
                  })}
                </ToggleCollapse>
              </GroupingComponentListItem>
            );
          }

          return null;
        })}

        {!collapsed && items.length > maxVisibleItems && (
          <GroupingComponentListItem>
            <ToggleCollapse
              size="small"
              priority="link"
              icon={<IconSubtract size="8px" />}
              onClick={() => this.setState({collapsed: true})}
            >
              {tct('collapse [numberOfFrames] similiar', {
                numberOfFrames: items.length - maxVisibleItems,
              })}
            </ToggleCollapse>
          </GroupingComponentListItem>
        )}
      </React.Fragment>
    );
  }
}

const ToggleCollapse = styled(Button)`
  margin: ${space(0.5)} 0;
`;

export default GroupingComponentFrames;
