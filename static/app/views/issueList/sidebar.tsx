import * as React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import map from 'lodash/map';

import Input from 'sentry/components/forms/controls/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SidebarSection from 'sentry/components/sidebarSection';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Tag, TagCollection} from 'sentry/types';
import {objToQuery, QueryObj, queryToObj} from 'sentry/utils/stream';

import IssueListTagFilter from './tagFilter';
import {TagValueLoader} from './types';

type DefaultProps = {
  onQueryChange: (query: string) => void;
  query: string;
  tags: TagCollection;
};

type Props = DefaultProps & {
  tagValueLoader: TagValueLoader;
  loading?: boolean;
};

type State = {
  queryObj: QueryObj;
  textFilter: string;
};

class IssueListSidebar extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    tags: {},
    query: '',
    onQueryChange: function () {},
  };

  state: State = {
    queryObj: queryToObj(this.props.query),
    textFilter: queryToObj(this.props.query).__text,
  };

  componentWillReceiveProps(nextProps: Props) {
    // If query was updated by another source (e.g. SearchBar),
    // clobber state of sidebar with new query.
    const query = objToQuery(this.state.queryObj);

    if (!isEqual(nextProps.query, query)) {
      const queryObj = queryToObj(nextProps.query);
      this.setState({
        queryObj,
        textFilter: queryObj.__text,
      });
    }
  }

  onSelectTag = (tag: Tag, value: string | null) => {
    const newQuery = {...this.state.queryObj};
    if (value) {
      newQuery[tag.key] = value;
    } else {
      delete newQuery[tag.key];
    }

    this.setState(
      {
        queryObj: newQuery,
      },
      this.onQueryChange
    );
  };

  onTextChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({textFilter: evt.target.value});
  };

  onTextFilterSubmit = (evt?: React.FormEvent<HTMLFormElement>) => {
    evt && evt.preventDefault();

    const newQueryObj = {
      ...this.state.queryObj,
      __text: this.state.textFilter,
    };

    this.setState(
      {
        queryObj: newQueryObj,
      },
      this.onQueryChange
    );
  };

  onQueryChange = () => {
    const query = objToQuery(this.state.queryObj);
    this.props.onQueryChange && this.props.onQueryChange(query);
  };

  onClearSearch = () => {
    this.setState(
      {
        textFilter: '',
      },
      this.onTextFilterSubmit
    );
  };

  render() {
    const {loading, tagValueLoader, tags} = this.props;
    return (
      <StreamSidebar>
        {loading ? (
          <LoadingIndicator />
        ) : (
          <React.Fragment>
            <SidebarSection title={t('Text')}>
              <form onSubmit={this.onTextFilterSubmit}>
                <Input
                  placeholder={t('Search title and culprit text body')}
                  onChange={this.onTextChange}
                  value={this.state.textFilter}
                />
                {this.state.textFilter && (
                  <StyledIconClose size="xs" onClick={this.onClearSearch} />
                )}
              </form>
              <StyledHr />
            </SidebarSection>

            {map(tags, tag => (
              <IssueListTagFilter
                value={this.state.queryObj[tag.key]}
                key={tag.key}
                tag={tag}
                onSelect={this.onSelectTag}
                tagValueLoader={tagValueLoader}
              />
            ))}
          </React.Fragment>
        )}
      </StreamSidebar>
    );
  }
}

export default IssueListSidebar;

const StreamSidebar = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  position: absolute;
  top: 13px;
  right: 10px;
  color: ${p => p.theme.gray200};

  &:hover {
    color: ${p => p.theme.gray300};
  }
`;

const StyledHr = styled('hr')`
  margin: ${space(2)} 0 0;
  border-top: solid 1px ${p => p.theme.innerBorder};
`;
