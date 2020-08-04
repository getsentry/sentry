import React from 'react';
import * as Sentry from '@sentry/react';

import getDisplayName from 'app/utils/getDisplayName';

import {TAB} from './utils';
import {DashboardData} from './teamDetails/dashboard/types';

const LS_KEY = 'HACKWEEK_TEAM_PAGE';
const DEFAULT_STATE = {
  [TAB.DASHBOARD]: null,
  [TAB.ALL_TEAMS]: null,
  [TAB.MY_TEAMS]: null,
};

export type InjectedLocalStorageProps = {
  data: Record<TAB, DashboardData | any> | undefined;
  setLs: (data: any) => void;
  resetLs: (defaultState: any) => void;
  resetLsAll: () => void;
};

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

    state = {...DEFAULT_STATE};

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

    setLs = (data: any = {}) => {
      const nextState = {
        ...this.state,
        [tabName]: data,
      };

      console.log('ls.set', nextState); // eslint-disable-line no-console
      localStorage.setItem(LS_KEY, JSON.stringify(nextState));
      this._getLs();
    };

    /**
     * @param defaultState - Empty default state for a tab
     */
    resetLs = (defaultState: any) => {
      if (!defaultState) {
        throw new Error('You must provide a defaultState for your tab');
      }

      // Dump state before reset
      console.log('ls.reset', JSON.stringify(this.state)); // eslint-disable-line no-console

      const nextState = {
        ...this.state,
        [tabName]: defaultState,
      };

      localStorage.setItem(LS_KEY, JSON.stringify(nextState));
      this._getLs();
    };

    resetLsAll = () => {
      // Dump state before reset
      console.log('ls.resetAll', JSON.stringify(this.state)); // eslint-disable-line no-console

      localStorage.setItem(LS_KEY, JSON.stringify({...DEFAULT_STATE}));
      this._getLs();
    };

    render() {
      return (
        <WrappedComponent
          {...(this.props as P)}
          data={this.state[tabName]}
          setLs={this.setLs}
          resetLs={this.resetLs}
          resetLsAll={this.resetLsAll}
        />
      );
    }
  };

export default withLocalStorage;
