import React from 'react';
import * as Sentry from '@sentry/react';

import getDisplayName from 'app/utils/getDisplayName';

import {TAB} from './utils';
import {FeedData} from './teamDetails/feed/types';
import {LocalStorageDashboardType} from './types';

const LS_KEY = 'HACKWEEK_TEAM_PAGE';
const DEFAULT_STATE = {
  [TAB.DASHBOARD]: null,
  [TAB.ALL_TEAMS]: null,
  [TAB.MY_TEAMS]: null,
};

export type InjectedLocalStorageProps = {
  data: Record<TAB, FeedData | any> | undefined;
  setLs: (key: string, data: LocalStorageDashboardType) => void;
  resetLs: (key: string, defaultState: any) => void;
  resetLsAll: () => void;
};

export type LocalStorageChildrenProps = {
  data: Record<TAB, FeedData | any> | undefined;
  setLocalStorageData: (data: any) => void;
};

const LocalStorageContext = React.createContext<LocalStorageChildrenProps>({
  data: undefined,
  setLocalStorageData: () => {},
});

type Props = {};

type State = {
  [TAB.DASHBOARD]: null | LocalStorageDashboardType;
  [TAB.ALL_TEAMS]: null | any;
  [TAB.MY_TEAMS]: null | any;
};

export class Provider extends React.Component<Props, State> {
  state: State = {...DEFAULT_STATE};

  componentDidMount() {
    this._getLs();
  }

  private _getLs() {
    try {
      const data = localStorage.getItem(LS_KEY);
      // console.log('ls.get', data);
      this.setState(data ? JSON.parse(data) : {});
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      Sentry.captureException(err);
    }
  }

  setLocalStorageData = (nextState: any = {}) => {
    console.log('ls.set', nextState); // eslint-disable-line no-console
    localStorage.setItem(LS_KEY, JSON.stringify(nextState));
    this._getLs();
  };

  render() {
    const childrenProps: LocalStorageChildrenProps = {
      data: this.state,
      setLocalStorageData: this.setLocalStorageData,
    };

    return (
      <LocalStorageContext.Provider value={childrenProps}>
        {this.props.children}
      </LocalStorageContext.Provider>
    );
  }
}

export const Consumer = LocalStorageContext.Consumer;

/**
 * This HOC helps to stringify/parse JSON as LocalStorage stores strings only
 * If the parsing fails, state will be reset to empty
 *
 * The API is generic as each tab is expected to have their own unique state
 * structure and will enforce the type of that structure in their respective
 * folders.
 */
const withLocalStorage = <P extends InjectedLocalStorageProps>(
  WrappedComponent: React.ComponentType<P>,
  tabName: TAB
) =>
  class extends React.Component<Omit<P, keyof InjectedLocalStorageProps>> {
    static displayName = `withLocalStorage(${getDisplayName(WrappedComponent)})`;

    setLs = (setLocalStorageData, prevData) => (
      key: string,
      data: LocalStorageDashboardType = {}
    ) => {
      const tabData = prevData[tabName] ?? {};
      const nextState = {
        ...prevData,
        [tabName]: {
          ...tabData,
          [key]: data,
        },
      };

      setLocalStorageData(nextState);
    };

    /**
     * @param defaultState - Empty default state for a tab
     */
    resetLs = (setLocalStorageData, prevdata) => (key: string, defaultState: any) => {
      if (!defaultState) {
        throw new Error('You must provide a defaultState for your tab');
      }

      // Dump state before reset
      console.log('ls.reset', JSON.stringify(prevdata)); // eslint-disable-line no-console

      const tabData = prevdata[tabName] ?? {};
      const nextState = {
        ...prevdata,
        [tabName]: {
          ...tabData,
          [key]: defaultState,
        },
      };

      setLocalStorageData(nextState);
    };

    resetLsAll = (setLocalStorageData, prevData) => () => {
      // Dump state before reset
      console.log('ls.resetAll', JSON.stringify(prevData)); // eslint-disable-line no-console

      setLocalStorageData({...DEFAULT_STATE});
    };

    render() {
      return (
        <LocalStorageContext.Consumer>
          {({data, setLocalStorageData}: LocalStorageChildrenProps) => {
            const tabLocalData = (data ?? {})[tabName] ?? {};
            return (
              <WrappedComponent
                {...(this.props as P)}
                data={tabLocalData}
                setLs={this.setLs(setLocalStorageData, data)}
                resetLs={this.resetLs(setLocalStorageData, data)}
                resetLsAll={this.resetLsAll(setLocalStorageData, data)}
              />
            );
          }}
        </LocalStorageContext.Consumer>
      );
    }
  };

export default withLocalStorage;
