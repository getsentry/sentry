import {Component} from 'react';

import {Client} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import {Group, Organization, PageFilters} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

import {getDatasetConfig} from '../datasetConfig/base';
import {IssuesConfig} from '../datasetConfig/issues';
import {Widget, WidgetType} from '../types';

import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
} from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (results: {pageLinks?: string; totalIssuesCount?: string}) => void;
};

class IssueWidgetQueries extends Component<Props> {
  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
  }

  unlisteners = [
    MemberListStore.listen(() => {
      this.setState({
        memberListStoreLoaded: MemberListStore.isLoaded(),
      });
    }, undefined),
  ];

  config = getDatasetConfig(WidgetType.ISSUE);

  render() {
    const config = IssuesConfig;
    const {children, api, organization, selection, widget, cursor, limit, onDataFetched} =
      this.props;

    return getDynamicText({
      value: (
        <GenericWidgetQueries<never, Group[]>
          config={config}
          api={api}
          organization={organization}
          selection={selection}
          widget={widget}
          cursor={cursor}
          limit={limit}
          onDataFetched={onDataFetched}
          processRawTableResult={() => {}}
        >
          {children}
        </GenericWidgetQueries>
      ),
      fixed: <div />,
    });
  }
}

export default IssueWidgetQueries;
