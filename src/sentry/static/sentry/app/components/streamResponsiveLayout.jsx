/* eslint no-shadow: 0*/
import {observer} from 'mobx-react';
import {observable, computed, action} from 'mobx';
import PropTypes from 'prop-types';
import React from 'react';

import Responsive from './responsive';

const SIZE = {
  TINY: 0,
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
  FULL: 4,
};

class Store {
  @observable size = 3;
  @observable visible = false;

  @action
  setSize(size) {
    console.log('set size', size);
    this.size = size;
    return null;
  }

  @action
  toggleStreamSidebar() {
    this.visible = !this.visible;
    console.log(this.visible);
  }

  @computed
  get showMerge() {
    return this.size >= SIZE.LARGE;
  }
  @computed
  get showBookmarks() {
    return this.size >= SIZE.LARGE;
  }

  @computed
  get showPause() {
    return this.size >= SIZE.SMALL;
  }

  @computed
  get showResolveLabel() {
    return this.size >= SIZE.FULL;
  }

  @computed
  get showIgnoreLabel() {
    return this.showResolveLabel;
  }

  @computed
  get showGraph() {
    return this.size >= SIZE.LARGE;
  }

  @computed
  get showAssignee() {
    return this.size >= SIZE.MEDIUM;
  }

  @computed
  get isStreamSidebarVisible() {
    return this.visible;
  }
}

const store = new Store();

@observer
class StreamResponsiveLayout extends React.Component {
  static propTypes = {
    minWidth: PropTypes.number,
    maxWidth: PropTypes.number,
    sidebarCollapsed: PropTypes.bool,
    useSidebar: PropTypes.bool,
    useStreamSidebar: PropTypes.bool,
  };

  render() {
    let {...props} = this.props;
    let responsiveProps = {
      useStreamSidebar: true,
      useSidebar: true,
      streamSidebarCollapsed: !store.isStreamSidebarVisible,
    };
    let children = ({size}) => store.setSize(size);

    return (
      <Responsive {...responsiveProps} maxWidth={420}>
        {matches =>
          matches ? (
            children({...props, size: 0})
          ) : (
            <Responsive {...responsiveProps} minWidth={421} maxWidth={640}>
              {matches =>
                matches ? (
                  children({...props, size: 1})
                ) : (
                  <Responsive {...responsiveProps} minWidth={641} maxWidth={904}>
                    {matches =>
                      matches ? (
                        children({...props, size: 2})
                      ) : (
                        <Responsive {...responsiveProps} minWidth={905} maxWidth={1039}>
                          {matches =>
                            matches ? (
                              children({...props, size: 3})
                            ) : (
                              <Responsive {...responsiveProps} minWidth={1040}>
                                {matches =>
                                  matches
                                    ? children({...props, size: 4})
                                    : children({...props, size: 4})}
                              </Responsive>
                            )}
                        </Responsive>
                      )}
                  </Responsive>
                )}
            </Responsive>
          )}
      </Responsive>
    );
  }
}

export default StreamResponsiveLayout;
export {store};
