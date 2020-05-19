// TODO(matej): I would like to refactor this to reusable component
import React from 'react';

import {tct} from 'app/locale';
import Button from 'app/components/button';

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

    return (
      <React.Fragment>
        {items.map((item, index) => {
          if (!collapsed || index < maxVisibleItems) {
            return item;
          }

          if (index === maxVisibleItems) {
            return (
              <GroupingComponentListItem>
                <Button
                  size="small"
                  priority="link"
                  onClick={() => this.setState({collapsed: false})}
                >
                  +{' '}
                  {tct('show [numberOfFrames] similiar', {
                    numberOfFrames: items.length - maxVisibleItems,
                  })}
                </Button>
              </GroupingComponentListItem>
            );
          }

          return null;
        })}

        {!collapsed && items.length > maxVisibleItems && (
          <GroupingComponentListItem>
            <Button
              size="small"
              priority="link"
              onClick={() => this.setState({collapsed: true})}
            >
              -{' '}
              {tct('collapse [numberOfFrames] similiar', {
                numberOfFrames: items.length - maxVisibleItems,
              })}
            </Button>
          </GroupingComponentListItem>
        )}
      </React.Fragment>
    );
  }
}

export default GroupingComponentFrames;
