import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import map from 'lodash/map';

import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  joinQuery,
  ParseResult,
  parseSearch,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Tag, TagCollection} from 'sentry/types';

import IssueListTagFilter from './tagFilter';
import {TagValueLoader} from './types';

type DefaultProps = {
  onQueryChange: (query: string) => void;
  query: string;
  tags: TagCollection;
};

type Props = DefaultProps & {
  parsedQuery: ParseResult;
  tagValueLoader: TagValueLoader;
  loading?: boolean;
};

type State = {
  filters: Record<string, TokenResult<Token.Filter>>;
  textFilter: string;
};

class IssueListSidebar extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    tags: {},
    query: '',
    onQueryChange: function () {},
  };

  state: State = this.parsedQueryToState(this.props.parsedQuery);

  componentWillReceiveProps(nextProps: Props) {
    if (!isEqual(nextProps.query, this.props.query)) {
      this.setState(this.parsedQueryToState(nextProps.parsedQuery));
    }
  }

  parsedQueryToState(parsedQuery: ParseResult): State {
    const parsedFilters = parsedQuery.filter(
      (p): p is TokenResult<Token.Filter> => p.type === Token.Filter
    );

    return {
      filters: Object.fromEntries(parsedFilters.map(p => [p.key.text, p])),
      textFilter: joinQuery(parsedQuery.filter(p => p.type === Token.FreeText)),
    };
  }

  onSelectTag = (tag: Tag, value: string | null) => {
    const parsedResult: TokenResult<Token.Filter>[] = (
      parseSearch(`${tag.key}:${value}`) ?? []
    ).filter((p): p is TokenResult<Token.Filter> => p.type === Token.Filter);
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    if (parsedResult.length !== 1 || parsedResult[0].type !== Token.Filter) {
      return;
    }
    const newEntry = parsedResult[0] as TokenResult<Token.Filter>;
    const newFilters = {...this.state.filters};

    if (value) {
      newFilters[tag.key] = newEntry;
    } else {
      delete newFilters[tag.key];
    }

    this.setState(
      {
        filters: newFilters,
      },
      this.onQueryChange
    );
  };

  onTextChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({textFilter: evt.target.value});
  };

  onQueryChange = () => {
    const newQuery = [
      joinQuery(Object.values(this.state.filters), false, true),
      this.state.textFilter,
    ]
      .filter(f => f) // filter out empty strings
      .join(' ');

    this.props.onQueryChange && this.props.onQueryChange(newQuery);
  };

  onClearSearch = () => {
    this.setState(
      {
        textFilter: '',
      },
      this.onQueryChange
    );
  };

  render() {
    const {loading, tagValueLoader, tags} = this.props;
    // TODO: @taylangocmen: 1. We need to render negated tags better, 2. We need an option to add negated tags to query
    return (
      <StreamSidebar>
        {loading ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
            <SidebarSection.Wrap>
              <SidebarSection.Title>{t('Text')}</SidebarSection.Title>
              <SidebarSection.Content>
                <form onSubmit={this.onQueryChange}>
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
              </SidebarSection.Content>
            </SidebarSection.Wrap>

            {map(tags, tag => (
              <IssueListTagFilter
                value={this.state.filters[tag.key]?.value.text || undefined}
                key={tag.key}
                tag={tag}
                onSelect={this.onSelectTag}
                tagValueLoader={tagValueLoader}
              />
            ))}
          </Fragment>
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
