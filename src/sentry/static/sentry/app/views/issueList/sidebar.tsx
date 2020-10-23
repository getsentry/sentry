import PropTypes from 'prop-types';
import React from 'react';
import isEqual from 'lodash/isEqual';
import map from 'lodash/map';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';
import {IconClose} from 'app/icons/iconClose';
import {queryToObj, objToQuery, QueryObj} from 'app/utils/stream';
import {t} from 'app/locale';
import {Tag, TagCollection} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import {TagValueLoader} from './types';
import IssueListTagFilter from './tagFilter';

type DefaultProps = {
  tags: TagCollection;
  query: string;
  onQueryChange: (query: string) => void;
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
  static propTypes: any = {
    tags: PropTypes.objectOf(SentryTypes.Tag).isRequired,
    query: PropTypes.string,
    onQueryChange: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    tagValueLoader: PropTypes.func.isRequired,
  };

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
            <StreamTagFilter>
              <StyledHeader>{t('Text')}</StyledHeader>
              <form onSubmit={this.onTextFilterSubmit}>
                <input
                  className="form-control"
                  placeholder={t('Search title and culprit text body')}
                  onChange={this.onTextChange}
                  value={this.state.textFilter}
                />
                {this.state.textFilter && (
                  <StyledIconClose size="xs" onClick={this.onClearSearch} />
                )}
              </form>
              <StyledHr />
            </StreamTagFilter>

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
  color: ${p => p.theme.gray400};

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;

const StyledHeader = styled('h6')`
  color: #7c6a8e;
  margin-bottom: 10px;
`;

const StreamTagFilter = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledHr = styled('hr')`
  margin: ${space(2)} 0 0;
`;
