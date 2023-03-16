import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

class GroupingComponentFrames extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxVisibleItems: 2,
  };

  state: State = {
    collapsed: true,
  };

  render() {
    const {items, maxVisibleItems} = this.props;
    const {collapsed} = this.state;
    const isCollapsible = items.length > maxVisibleItems;

    return (
      <Fragment>
        {items.map((item, index) => {
          if (!collapsed || index < maxVisibleItems) {
            return (
              <GroupingComponentListItem isCollapsible={isCollapsible} key={index}>
                {item}
              </GroupingComponentListItem>
            );
          }

          if (index === maxVisibleItems) {
            return (
              <GroupingComponentListItem key={index}>
                <ToggleCollapse
                  size="sm"
                  priority="link"
                  icon={<IconAdd legacySize="8px" />}
                  onClick={() => this.setState({collapsed: false})}
                >
                  {tct('show [numberOfFrames] similar', {
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
              size="sm"
              priority="link"
              icon={<IconSubtract legacySize="8px" />}
              onClick={() => this.setState({collapsed: true})}
            >
              {tct('collapse [numberOfFrames] similar', {
                numberOfFrames: items.length - maxVisibleItems,
              })}
            </ToggleCollapse>
          </GroupingComponentListItem>
        )}
      </Fragment>
    );
  }
}

const ToggleCollapse = styled(Button)`
  margin: ${space(0.5)} 0;
  color: ${p => p.theme.linkColor};
`;

export default GroupingComponentFrames;
